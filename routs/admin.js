const express = require("express")
const router = express.Router()
const User = require("../db/users")
const Transaction = require("../db/transaction")
const Notification = require("../db/notification")
const Server = require("../db/server")
const Plan = require("../db/plan")
const helper = require("../container/helper")
const res_handler = require("../container/res_handler")
var shortHash = require('short-hash');
const { uid } = require("uid")
const midels = require("../container/midel")


router.post("/sign_new_client", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "user_name",
            "password",
            "access",
            "phone",
            "name"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.faild(res, "INVALID_INPUTS")
    const { user_name, password, access, phone, name } = req.body
    if (!helper.check_phone(phone)) return res_handler.faild(res, "INVALID_PHONE")
    const is_exist = await User.findOne({ $or: [{ user_name }, { phone }] })
    if (is_exist) return res_handler.faild(res, "DUPLICATE")
    const user_id = uid(6)
    const new_client = {
        user_id,
        user_name,
        password: shortHash(password),
        access,
        phone,
        name
    }
    new User(new_client).save()
    res_handler.succsess(res, "کاربر با موفقیت ثبت شد")
})


router.post("/add_credit", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "user_id",
            "credit",
        ], req.body
    )
    if (!valid_inputs) return res_handler.faild(res, "INVALID_INPUTS")


    const { credit, user_id, user } = req.body
    const { user_id: creator } = user
    if (credit == 0) return res_handler.faild(res, "INVALID_VALUES")
    await User.findOneAndUpdate({ user_id }, { $inc: { credit } })
    res_handler.succsess(res, "موجودی با موفقیت تغییر کرذ", {})

    const new_transaction = {
        credit, creator, user_id, note: +credit > 0 ? "واریز" : "براشت", date: Date.now(), transaction_id: uid(8)
    }
    new Transaction(new_transaction).save()
    const new_notification = {
        resivers: [user_id],
        date: Date.now(),
        notification_id: uid(5),
        note: `اعتبار حساب شما به میازان ${credit} ${+credit > 0 ? "افزایش" : "کاهش"} یافت`
    }
    new Notification(new_notification).save()

})


router.post("/block_client", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "user_id",
            "active"
        ], req.body
    )
    if (!valid_inputs) return res_handler.faild(res, "INVALID_INPUTS")
    const { active, user_id } = req.body
    await User.findOneAndUpdate({ user_id }, { $set: { active } })
    res_handler.succsess(res, "وضعیت کاربر با موفقیت تغییر کرد", {})


})


router.post("/add_plan", midels.check_admin, async (req, res) => {

    const valid_inputs = helper.check_inputs(
        [
            "dis",
            "price",
            "duration",
            "volume",
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.faild(res, "INVALID_INPUTS")
    const { dis, price, duration, volume } = req.body
    const new_plan = {
        plan_id: uid(5),
        dis, price, duration, volume,
    }
    new Plan(new_plan).save()

    const new_notification = {
        resivers: ["all"],
        date: Date.now(),
        notification_id: uid(5),
        note: `پلن جدید :${dis} به پلن های فروش اضافه شد !`
    }
    new_notification.save()
    res_handler.succsess(res, "پلن جدید اضافه شد", {})

})


router.post("/add_server", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "url",
            "user_name",
            "password",
            "dis",
            "capacity",
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.faild(res, "INVALID_INPUTS")
    const {
        url,
        user_name,
        password,
        dis,
        capacity
    } = req.body
    const new_server = {
        url,
        user_name,
        password,
        dis,
        capacity,
        server_id: uid(5)
    }
    new Server(new_server).save()
    res_handler.succsess(res, "سرور جدید اضافه شد", {})
    const new_notification = {
        resivers: ["all"],
        date: Date.now(),
        notification_id: uid(5),
        note: `سرور جدید :${dis} به سرور ها اضافه شد !`
    }
    new_notification.save()


})


router.post("/send_notification", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "note"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.faild(res, "INVALID_INPUTS")
    const { note } = req.body
    const new_notification = {
        resivers: ["all"],
        date: Date.now(),
        notification_id: uid(5),
        note: `‍پیام ادمین: ${note}`
    }
    new Notification(new_notification).save()
    res_handler.succsess(res, "اعلان جدید ارسال شد", {})
})






module.exports = router