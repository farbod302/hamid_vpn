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
const fs = require("fs")
const server_class = require("../container/new_server_handler")
const Ticket = require("../db/ticket")
const Activity = require("../db/activites")

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
    const { user_name, password, access, phone, name, user } = req.body
    if (!helper.check_phone(phone)) return res_handler.failed(res, "INVALID_PHONE")
    const is_exist = await User.findOne({ $or: [{ user_name }, { phone }], delete: false })
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
    await new User(new_client).save()
    res_handler.success(res, "کاربر با موفقیت ثبت شد")
    helper.add_activity(`نمایندگی جدید ${name} اضافه شد`, user.user_id)
})

router.post("/edit_client", midels.check_admin,async (req, res) => {

    const valid_inputs = helper.check_inputs(
        [
            "name",
            "user_name",
            "user_id",
            "phone",
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")

    const {name,user_name,user_id,phone}=req.body
    await User.findOneAndUpdate({user_id},{$set:{name,user_name,phone}})
    res_handler.success(res, "کاربر با موفقیت ویرایش شد")


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
    const s_user = await User.findOneAndUpdate({ user_id }, { $inc: { credit: +credit } })
    console.log(s_user);
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
    helper.add_activity(`موجودی حساب ${s_user.name} به میزان ${credit} توسط ادمین شارژ شد`, user.user_id)

})





router.post("/block_client", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "user_id",
            "active"
        ], req.body
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { active, user_id, user: _user } = req.body
    const user = await User.findOneAndUpdate({ user_id }, { $set: { active } })
    res_handler.success(res, "وضعیت کاربر با موفقیت تغییر کرد", {})
    helper.add_activity(` ${user.user_name} :نمایندگی ${active ? "فعال" : "غیر فعال"} شد`, _user.user_id)


})


router.post("/add_plan", midels.check_admin, async (req, res) => {

    const valid_inputs = helper.check_inputs(
        [
            "dis",
            "price",
            "duration",
            "volume",
            "grpc"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { dis, price, duration, volume, grpc, user } = req.body
    const new_plan = {
        plan_id: uid(5),
        dis, price, duration, volume, grpc
    }
    await new Plan(new_plan).save()

    const new_notification = {
        rasivers: ["all"],
        date: Date.now(),
        notification_id: uid(5),
        note: `پلن جدید :${dis} به پلن های فروش اضافه شد !`
    }
    new Notification(new_notification).save()
    res_handler.success(res, "پلن جدید اضافه شد", {})
    helper.add_activity(`  طرح فروش جدید(${dis}) اضافه شد`, user.user_id)
})


router.post("/edit_plan", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "dis",
            "price",
            "duration",
            "volume",
            "plan_id",
            "grpc"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { dis, price, duration, volume, plan_id, grpc, user } = req.body
    const new_plan = {
        plan_id,
        dis, price, duration, volume, grpc
    }

    const plan = await Plan.findOneAndReplace({ plan_id }, new_plan)
    res_handler.success(res, "پلن ویرایش شد", {})
    helper.add_activity(`پلن فروش: ${plan.dis} ویرایش شد`, user.user_id)


})


router.post("/add_server", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "url",
            "user_name",
            "password",
            "dis",
            "sub_port",
            "capacity",
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const {
        url,
        user_name,
        password,
        dis,
        capacity,
        user,
        sub_port

    } = req.body

    const new_server_class = new server_class({ url, user_name, password: helper.encrypt(password) })
    try {
        await new_server_class.init_server()
        const new_server = {
            url,
            user_name,
            password: helper.encrypt(password),
            dis,
            capacity,
            server_id: uid(5),
            sub_port
        }
        await new Server(new_server).save()
        res_handler.success(res, "سرور جدید اضافه شد", {})
        const new_notification = {
            rasivers: ["all"],
            date: Date.now(),
            notification_id: uid(5),
            note: `سرور جدید :${dis} به سرور ها اضافه شد !`
        }
        new Notification(new_notification).save()
        all_servers.init_all_servers()
    } catch (err) {
        console.log({ err });
        res_handler.failed(res, "INVALID_SERVER")
    }
    helper.add_activity(`سرور جدید اضاه شد ${dis}`, user.user_id)


})


router.post("/delete_notification", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "notification_id",
            "is_admin_note"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { notification_id, is_admin_note } = req.body
    if (is_admin_note) {
        const new_admin_note = {
            msg: "",
            expire_date: Date.now() - 100
        }
        fs.writeFileSync(`${__dirname}/../admin_msg.json`, JSON.stringify(new_admin_note))
    } else {
        await Notification.findByIdAndDelete(notification_id)
    }
    res_handler.success(res, "اعلان حذف شد", {})

})


router.post("/edit_server", midels.check_admin, async (req, res) => {

    const valid_inputs = helper.check_inputs(
        [
            "url",
            "user_name",
            "password",
            "dis",
            "sub_port",
            "capacity",
            "server_id",
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const {
        url,
        user_name,
        password,
        dis,
        sub_port,
        capacity,
        server_id,
        user
    } = req.body
    const new_server_class = new server_class({ url, user_name, password: helper.encrypt(password) })

    try {
        await new_server_class.init_server()
        const cur_status = await Server.findOne({ server_id })
        const { capacity_used } = cur_status
        const new_server = {
            url,
            user_name,
            password: helper.encrypt(password),
            dis,
            capacity,
            sub_port,
            server_id,
            capacity_used,
        }

        await Server.findOneAndReplace({ server_id }, new_server)
        res_handler.success(res, "سرور ویرایش شد", {})
        helper.add_activity(`سرور ${dis} ویرایش شد`, user.user_id)
        all_servers.init_all_servers()
    } catch (err) {
        console.log(err);
        res_handler.failed(res, "INVALID_SERVER_INFO")
    }


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


router.post("/delete_user", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "user_id"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { user_id, user } = req.body
    const s_user = await User.findOneAndUpdate({ user_id }, { $set: { delete: true, active: false } })
    res_handler.success(res, "کاربر حذف شد", {})
    helper.add_activity(`نماینده حذف شد ${s_user.name}`, user.user_id)

})


router.post("/delete_server", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "server_id"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { server_id, user } = req.body
    const s_server = await Server.findOneAndUpdate({ server_id }, { $set: { delete: true } })
    res_handler.success(res, "سرور حذف شد", {})
    helper.add_activity(`سرور حذف شد ${s_server.dis}`, user.user_id)

})

router.get("/plan_price/:service_id", async (req, res) => {
    const { service_id } = req.params
    const selected_service = await Service.findOne({ service_id })
    if (!selected_service) return res_handler.failed(res, "INVALID_SERVICE")
    const { plan_id } = selected_service
    const selected_plan = await Plan.findOne({ plan_id })
    res_handler.success(res, "", {
        price: selected_plan?.price || 0
    })
})


router.post("/delete_plan", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "plan_id"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { plan_id } = req.body
    const plan = await Plan.findOneAndUpdate({ plan_id }, { $set: { delete: true } })
    res_handler.success(res, "طرح فروش حذف شد", {})
    helper.add_activity(`طرح فروش ${plan?.dis} حذف شد`)
})


router.post("/add_service", midels.check_client, async (req, res) => {


    const valid_inputs = helper.check_inputs(
        [
            "server_id",
            "plan_id",
            "protocol",
            "name",
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    let { server_id, plan_id, protocol, name, user } = req.body
    name = name.replace("$", "")
    const { access, user_id } = user

    const selected_plan = await Plan.findOne({ plan_id, active: true })
    if (!selected_plan) return res_handler.failed(res, "INVALID_PLAN")
    if (access === 0) {
        const requested_client = await User.findOne({ user_id })
        const { credit } = requested_client
        const { price } = selected_plan
        if (price > credit) return res_handler.failed(res, "NOT_ENOUGH_CREDIT")
    }

    const { volume, duration } = selected_plan

    const new_service = {
        expire_date: duration == 0 ? 0 : Date.now() + (duration * 1000 * 60 * 60 * 24),
        flow: volume,
        server_id,
        protocol,
        name
    }

    const result = await all_servers.create_service(new_service)
    if (!result) return res_handler.failed(res, "SERVICE_UNAVAILABLE")
    const { id, expiryTime, client_email } = result
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
        end_date: expiryTime,
        client_email: client_email
    }

    new Service(service_to_save).save()
    res_handler.success(res, "سرویس با موفقیت ایجاد شد", result)

    await Server.findOneAndUpdate({ server_id }, { $inc: { capacity: -1, capacity_used: 1 } })

    if (access === 0) {
        await User.findOneAndUpdate({ user_id }, { $inc: { credit: selected_plan.price * -1 } })
        const new_transaction = {
            transaction_id: uid(8),
            credit: selected_plan.price * -1,
            date: Date.now(),
            user_id,
            created_by_admin: false,
            note: "خرید اشتراک جدید: سرویس " + name
        }
        new Transaction(new_transaction).save()


    }
    await Server.findOneAndUpdate({ server_id }, { $inc: { capacity: -1, capacity_used: 1 } })
    const selected_user = await User.findOne({ user_id })
    helper.add_activity(`سرور ${name} اضافه شد`, user_id)

})


router.post("/edit_service", midels.check_client, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "service_id",
            "server_id",
            "name",
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { service_id, name, server_id: new_server_id, user } = req.body
    const new_server = await Server.findOne({ server_id: new_server_id, active: true })
    if (!new_server) return res_handler.failed(res, "INVALID_SERVER")

    const selected_service = await Service.findOne({ service_id })
    if (!selected_service) return res_handler.failed("INVALID_SERVICE")
    const { server_id, service_id_on_server, creator_id, client_email, protocol } = selected_service

    const { access, user_id } = user

    if (access === 0) {
        if (user_id !== creator_id) return res_handler.failed(res, "ACCESS_DENY")
    }

    if (server_id === new_server_id) {
        const result = await all_servers.edit_service_name({
            name, service_id_on_server, server_id, client_email
        })
        if (result) {
            const old_name = await Service.findOneAndUpdate({ client_email }, { $set: { client_email: result, name: name } })
            helper.add_activity(`نام سرور ${old_name.name} به ${name} تغییر کرد`, user_id)
            return res_handler.success(res, "سرویس با موفقیت ویرایش شد", result)
        }
    } else {
        const server_cur_status = await all_servers.get_service_data({ server_id, service_id_on_server, client_email })
        const { expiryTime, up, down } = server_cur_status
        await all_servers.delete_service({ server_id, service_id_on_server, client_email })

        const result = await all_servers.create_service({
            server_id: new_server_id,
            flow: selected_service.volume === 0 ? 0 : ((selected_service.volume) - ((up + down) / (1040 ** 3))),
            expire_date: expiryTime,
            name,
            protocol
        })
        if (!result) return res_handler.failed(res, "SERVICE_UNAVAILABLE")
        if (!result) return res_handler.failed(res, "UNKNOWN_ERROR")
        const { id } = result
        const old_server = await Server.findOne({ server_id: selected_service.server_id })
        const new_server = await Server.findOne({ server_id: new_server_id })
        await Service.findOneAndUpdate({ service_id }, { $set: { service_id_on_server: id, server_id: new_server_id } })
        await Server.findOneAndUpdate({ server_id }, { $inc: { capacity: 1 } })
        await Server.findOneAndUpdate({ server_id: new_server_id }, { $inc: { capacity: -1 } })
        await Service.findOneAndUpdate({ service_id }, { $set: { client_email: result.client_email || "" } })
        helper.add_activity(`سرور ${selected_service.name} از سرور ${old_server.dis} به سرور ${new_server.dis} منتقل شد`, user_id)

        return res_handler.success(res, "سرویس با موفقیت ویرایش شد", result)

    }


})

router.post("/disable_enable_server", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "server_id",
            "op"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { op, server_id, user } = req.body
    const server = await Server.findOneAndUpdate({ server_id }, { $set: { active: op } })
    helper.add_activity(`سرور ${server.dis} ${op ? "فعال" : "غیر فعال"} شد`, user.user_id)
    return res_handler.success(res, "سرور با موفقیت ویرایش شد", {})



})


router.post("/disable_enable_service", midels.check_client, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "service_id",
            "op"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { op, service_id, user } = req.body
    const selected_service = await Service.findOne({ service_id })
    if (!selected_service) return res_handler.failed("INVALID_SERVICE")
    const { service_id_on_server, server_id, client_email, end_date } = selected_service
    if (end_date < Date.now() && end_date !== 0) return res_handler.failed(res, "SERVICE_EXPIRE")
    await all_servers.disable_enable_service({ server_id, service_id_on_server, op, client_email })
    helper.add_activity(`سرویس ${selected_service.name} ${op ? "فعال" : "غیر فعال"} شد`)

    res_handler.success(res, "تغییرات با موفقیت انجام شد", user.user_id)


})


router.post("/disable_enable_plan", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "plan_id",
            "op"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { op, plan_id, user } = req.body
    const selected_plan = await Plan.findOne({ plan_id })
    if (!selected_plan) return res_handler.failed("INVALID_SERVICE")
    const plan = await Plan.findOneAndUpdate({ plan_id }, { $set: { active: op } })
    res_handler.success(res, "تغییرات با موفقیت انجام شد", {})
    helper.add_activity(`پلن ${plan.dis} ${op ? "فعال" : "غیر فعال"} شد`, user.user_id)


})



router.post("/change_link", midels.check_client, async (req, res) => {



    const valid_inputs = helper.check_inputs(
        [
            "service_id",
        ], req.body || {}
    )

    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { service_id, user } = req.body
    const selected_service = await Service.findOne({ service_id })
    const { server_id, service_id_on_server, creator_id, is_grpc, client_email } = selected_service

    const { access, user_id } = user
    if (access === 0) {
        if (user_id !== creator_id) return res_handler.failed(res, "ACCESS_DENY")
    }

    const result = await all_servers.change_link({ server_id, service_id_on_server, is_grpc, client_email })
    res_handler.success(res, "تغییرات با موفقیت انجام شد", result)
    helper.add_activity()
    helper.add_activity(`لینک اتصال ${selected_service.name} تغییر کرد`, user.user_id)


})

router.post("/reset_service", midels.check_client, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "service_id",
        ], req.body || {}
    )

    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { service_id, user } = req.body
    const selected_service = await Service.findOne({ service_id })
    if (!selected_service) return res_handler.failed(res, "INVALID_SERVICE")
    const { server_id, service_id_on_server, plan_id, is_grpc, client_email, name } = selected_service
    const selected_plan = await Plan.findOne({ plan_id })
    const { price } = selected_plan
    const { access, user_id } = user
    if (access === 0) {
        const selected_user = await User.findOne({ user_id })
        const { credit } = selected_user
        if (credit < price) return res_handler.failed(res, "NOT_ENOUGH_CREDIT")
    }


    const { duration, volume } = selected_plan
    const new_ex_date = duration == 0 ? 0 : Date.now() + (duration * 1000 * 60 * 60 * 24)
    const result = await all_servers.reset_service({ server_id, service_id_on_server, new_ex_date, is_grpc, client_email, volume })
    await all_servers.disable_enable_service({
        server_id,
        service_id_on_server,
        op: true,
        client_email
    })
    res_handler.success(res, "سرویس تمدید شد", result)
    if (access === 0) {
        await User.findOneAndUpdate({ user_id }, { $inc: { credit: price * -1 } })
        const new_transaction = {
            transaction_id: uid(8),
            credit: price * -1,
            date: Date.now(),
            user_id,
            created_by_admin: false,
            note: "تمدید سرویس " + name
        }
        new Transaction(new_transaction).save()

    }
    await Service.findOneAndUpdate({ service_id }, { $set: { active: true, end_date: new_ex_date } })
    helper.add_activity(`سرویس ${selected_service.name} تمدید شد`, user_id)


})




router.post("/answer_ticket", midels.check_admin, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "ticket_id",
            "message"
        ], req.body || {}
    )

    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    const { ticket_id, message } = req.body
    await Ticket.findOneAndUpdate(
        { ticket_id },
        {

            $push: { messages: { sender: true, msg: message, date: Date.now() } },
            $set: { status: true }
        }
    )
    res_handler.success(res, "پاسخ شما ثبت شد")

})


router.post("/add_admin_note", midels.check_admin, (req, res) => {
    const { note } = req.body
    const new_admin_note = {
        msg: note,
        expire_date: Date.now() + (1000 * 60 * 60 * 24)
    }

    fs.writeFileSync(`${__dirname}/../admin_msg.json`, JSON.stringify(new_admin_note))
    res_handler.success(res, "پیام ثبت شد", {})
})

router.post("/reset_password", midels.check_admin, async (req, res) => {
    if (!helper.check_inputs(["user_id", "new_password"], req.body)) return res_handler.failed(res, "INVALID_INPUTS")
    const { user_id, new_password } = req.body
    await User.findOneAndUpdate({ user_id }, { $set: { password: shortHash(new_password) } })
    res_handler.success(res, "پسورد تغییر کرد", {})
})





module.exports = router