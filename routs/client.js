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
    const { server_id, plan_id, protocol, name, user } = req.body
    const selected_plan = await Plan.findOne({ plan_id, active: true })
    if (!selected_plan) return res_handler.failed(res, "INVALID_PLAN")
    const requested_client = await User.findOne({ user_id: user.user_id })
    const { credit } = requested_client
    const { price } = selected_plan
    if (price > credit) return res_handler.failed(res, "NOT_ENOUGH_CREDIT")
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
    await User.findOneAndUpdate({ user_id: user.user_id }, { $inc: { credit: price * -1 } })
    await Server.findOneAndUpdate({ server_id }, { $inc: { capacity: -1 } })

})




router.post("/get_service_trafic", async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "connection_link",
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    try {
        const { connection_link } = req.body
        if (connection_link.startsWith("vless") && connection_link.startsWith("vmess")) return res_handler.failed(res, "INVALID_LINK")
        const protocol = connection_link.startsWith("vless") ? "vless" : "vmess"
        if (protocol === "vless") {
            let url = connection_link.split("@")[1]
            const server_url = url.split(":")[0]
            const port = url.split(":")[1].split("?")[0]
            const selected_server = await Server.findOne({ url: { $regex: server_url } })
            const { server_id } = selected_server
            const servers_services = await all_servers.get_all_services({ server_id })
            const selected_service = servers_services.find(e => e.port == port)
            const { up, down, settings, expiryTime } = selected_service
            const { totalGB } = settings.clients[0]
            res_handler.success(res, "", {
                total: totalGB,
                used: up + down,
                expiryTime
            })
        } else {
            const base_64 = connection_link.split("//")[1]
            const data = JSON.parse(atob(base_64))
            const { port, add: server_url } = data
            const selected_server = await Server.findOne({ url: { $regex: server_url } })
            const { server_id } = selected_server
            const servers_services = await all_servers.get_all_services({ server_id })
            const selected_service = servers_services.find(e => e.port == port)
            const { up, down, settings, expiryTime } = selected_service
            const { totalGB } = settings.clients[0]
            res_handler.success(res, "", {
                total: totalGB,
                used: up + down,
                expiryTime
            })
        }
    }
    catch {
        return res_handler.failed(res, "INVALID_LINK")
    }
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
    if(!selected_service) return res_handler.failed(res, "INVALID_SERVICE")
    const { server_id, service_id_on_server, plan_id } = selected_service
    const selected_plan = await Plan.findOne({ plan_id })
    const { duration } = selected_plan
    const new_ex_date = duration == 0 ? 0 : Date.now() + (duration * 1000 * 60 * 60 * 24)
    const result = await all_servers.reset_service({ server_id, service_id_on_server, new_ex_date })
    res_handler.success(res, "سرویس تمدید شد", result)
    await Service.findOneAndUpdate({ server_id }, { $set: { active: true, end_date: new_ex_date } })


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
        const { expiryTime, protocol, up, down } = server_cur_status
        // todo :calc data used before
        await all_servers.delete_service({ server_id, service_id_on_server })
        const result = await all_servers.create_service({
            server_id: new_server_id, flow: selected_service.volume === 0 ? 0 : (selected_service.volume * (1024 ** 3) - (up + down)), expire_date: expiryTime, name, protocol
        })
        if (!result) return res_handler.failed("UNKNOWN_ERROR")
        const { id } = result
        await Service.findOneAndUpdate({ server_id }, { $set: { service_id_on_server: id, server_id: new_server_id } })
        await Server.findOneAndUpdate({ server_id }, { $inc: { capacity: 1 } })
        await Server.findOneAndUpdate({ server_id: new_server_id }, { $inc: { capacity: -1 } })
        return res_handler.success(res, "سرویس با موفقیت ویرایش شد", result)

    }


})




module.exports = router