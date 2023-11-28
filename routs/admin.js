const express = require("express")
const router = express.Router()
const User = require("../db/users")
const Transaction = require("../db/transaction")
const Notification = require("../db/notification")
const Server = require("../db/server")
const Service = require("../db/service")
const Plan = require("../db/plan")
const helper = require("../container/helper")
const res_handler = require("../container/res_handler")
var shortHash = require('short-hash');
const { uid } = require("uid")
const midels = require("../container/midel")
const all_servers = require("../container/all_servers")



//post requests

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
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { user_name, password, access, phone, name } = req.body
    if (!helper.check_phone(phone)) return res_handler.failed(res, "INVALID_PHONE")
    const is_exist = await User.findOne({ $or: [{ user_name }, { phone }] })
    if (is_exist) return res_handler.failed(res, "DUPLICATE")
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
    res_handler.success(res, "کاربر با موفقیت ثبت شد")
})


router.post("/add_credit", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "user_id",
            "credit",
        ], req.body
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")


    const { credit, user_id, user } = req.body
    const { user_id: creator } = user
    if (credit == 0) return res_handler.failed(res, "INVALID_VALUES")
    await User.findOneAndUpdate({ user_id }, { $inc: { credit: +credit } })
    res_handler.success(res, "موجودی با موفقیت تغییر کرد", {})

    const new_transaction = {
        credit, creator, user_id, note: +credit > 0 ? "واریز" : "براشت", date: Date.now(), transaction_id: uid(8)
    }
    new Transaction(new_transaction).save()
    const new_notification = {
        rasivers: [user_id],
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
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { active, user_id } = req.body
    await User.findOneAndUpdate({ user_id }, { $set: { active } })
    res_handler.success(res, "وضعیت کاربر با موفقیت تغییر کرد", {})


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
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { dis, price, duration, volume } = req.body
    const new_plan = {
        plan_id: uid(5),
        dis, price, duration, volume,
    }
    new Plan(new_plan).save()

    const new_notification = {
        rasivers: ["all"],
        date: Date.now(),
        notification_id: uid(5),
        note: `پلن جدید :${dis} به پلن های فروش اضافه شد !`
    }
    new Notification(new_notification).save()
    res_handler.success(res, "پلن جدید اضافه شد", {})

})


router.post("/edit_plan", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "dis",
            "price",
            "duration",
            "volume",
            "plan_id"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { dis, price, duration, volume, plan_id } = req.body
    const new_plan = {
        plan_id,
        dis, price, duration, volume,
    }

    await Plan.findOneAndReplace({ plan_id }, new_plan)
    res_handler.success(res, "پلن ویرایش شد", {})


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
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
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
        password: helper.encrypt(password),
        dis,
        capacity,
        server_id: uid(5)
    }
    new Server(new_server).save()
    res_handler.success(res, "سرور جدید اضافه شد", {})
    const new_notification = {
        rasivers: ["all"],
        date: Date.now(),
        notification_id: uid(5),
        note: `سرور جدید :${dis} به سرور ها اضافه شد !`
    }
    new Notification(new_notification).save()
    all_servers.init_all_servers()


})


router.post("/edit_server", midels.check_admin, async (req, res) => {

    const valid_inputs = helper.check_inputs(
        [
            "url",
            "user_name",
            "password",
            "dis",
            "capacity",
            "server_id"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const {
        url,
        user_name,
        password,
        dis,
        capacity,
        server_id
    } = req.body
    const cur_status = await Server.findOne({ server_id })
    const { capacity_used } = cur_status
    const new_server = {
        url,
        user_name,
        password: helper.encrypt(password),
        dis,
        capacity,
        server_id,
        capacity_used
    }

    await Server.findOneAndReplace({ server_id }, new_server)
    res_handler.success(res, "سرور ویرایش شد", {})
    all_servers.init_all_servers()

})


router.post("/send_notification", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "note"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { note } = req.body
    const new_notification = {
        rasivers: ["all"],
        date: Date.now(),
        notification_id: uid(5),
        note: `‍پیام ادمین: ${note}`
    }
    new Notification(new_notification).save()
    res_handler.success(res, "اعلان جدید ارسال شد", {})
})


router.post("/add_service", midels.check_admin, async (req, res) => {

    const valid_inputs = helper.check_inputs(
        [
            "server_id",
            "plan_id",
            "protocol",
            "name",
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { server_id, plan_id, protocol, name, user } = req.body
    const selected_plan = await Plan.findOne({ plan_id, active: true })
    if (!selected_plan) return res_handler.failed(res, "INVALID_PLAN")
    const { volume, duration } = selected_plan

    const new_service = {
        expire_date: duration == 0 ? 0 : Date.now() + (duration * 1000 * 60 * 60 * 24),
        flow: volume,
        server_id,
        protocol,
        name
    }

    const result = await all_servers.create_service(new_service)
    const { id, expiryTime } = result
    const service_to_save = {
        service_id: uid(6),
        service_id_on_server: id,
        creator_id: req.body.user.user_id,
        plan_id: plan_id,
        volume,
        name,
        server_id: server_id,
        protocol,
        credit: selected_plan.price,
        start_date: Date.now(),
        end_date: expiryTime
    }

    new Service(service_to_save).save()
    res_handler.success(res, "سرویس با موفقیت ایجاد شد", result)
    await Server.findOneAndUpdate({ server_id }, { $inc: { capacity: -1 } })

})


router.post("/edit_service", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "service_id",
            "server_id",
            "name",
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")

    const { service_id, name, server_id: new_server_id } = req.body

    const selected_service = await Service.findOne({ service_id })
    if (!selected_service) return res_handler.failed("INVALID_SERVICE")
    const { server_id, service_id_on_server } = selected_service
    if (server_id === new_server_id) {
        const result = await all_servers.edit_service_name({
            name, service_id_on_server, server_id
        })
        if (result) return res_handler.success(res, "سرویس با موفقیت ویرایش شد", result)
    } else {
        const server_cur_status = await all_servers.get_service_data({ server_id, service_id_on_server })
        const { expiryTime, total, protocol } = server_cur_status
        // todo :calc data used before
        await all_servers.delete_service({ server_id, service_id_on_server })
        const result = await all_servers.create_service({
            server_id: new_server_id, flow: total / (1024 ** 3), expire_date: expiryTime, name, protocol
        })
        if (!result) return res_handler.failed("UNKNOWN_ERROR")
        const { id } = result
        await Service.findOneAndUpdate({ server_id }, { $set: { service_id_on_server: id, server_id: new_server_id } })
        await Server.findOneAndUpdate({ server_id }, { $inc: { capacity: 1 } })
        await Server.findOneAndUpdate({ server_id: new_server_id }, { $inc: { capacity: -1 } })
        return res_handler.success(res, "سرویس با موفقیت ویرایش شد", result)

    }


})

router.post("/disable_enable_service", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "service_id",
            "op"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { op, service_id } = req.body
    const selected_service = await Service.findOne({ service_id })
    if (!selected_service) return res_handler.failed("INVALID_SERVICE")
    const { service_id_on_server, server_id } = selected_service
    const result = await all_servers.disable_enable_service({ server_id, service_id_on_server, op })
    res_handler.success(res, "تغییرات با موفقیت انجام شد", result)
    await Service.findOneAndUpdate({ server_id }, { $set: { active: op } })


})


router.post("/change_link", midels.check_admin, async (req, res) => {

    const valid_inputs = helper.check_inputs(
        [
            "service_id",
        ], req.body || {}
    )

    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { service_id } = req.body
    const selected_service = await Service.findOne({ service_id })

    const { server_id, service_id_on_server } = selected_service
    const result = await all_servers.change_link({ server_id, service_id_on_server })
    res_handler.success(res, "تغییرات با موفقیت انجام شد", result)



})

router.post("/reset_service", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "service_id",
        ], req.body || {}
    )

    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { service_id } = req.body
    const selected_service = await Service.findOne({ service_id })
    const { server_id, service_id_on_server, plan_id } = selected_service
    const selected_plan = await Plan.findOne({ plan_id })
    const { duration } = selected_plan
    const new_ex_date = duration == 0 ? 0 : Date.now() + (duration * 1000 * 60 * 60 * 24)
    const result = await all_servers.reset_service({ server_id, service_id_on_server, new_ex_date })
    res_handler.success(res, "سرویس تمدید شد", result)
    await Service.findOneAndUpdate({ server_id }, { $set: { active: true, end_date: new_ex_date } })


})










module.exports = router