const express = require("express")
const router = express.Router()
const Server = require("../db/server")
const Service = require("../db/service")
const User = require("../db/users")
const helper = require("../container/helper")
const res_handler = require("../container/res_handler")
const all_servers = require("../container/all_servers")
const midels = require("../container/midel")
const { uid } = require("uid")
const Ticket = require("../db/ticket")
var shortHash = require('short-hash');


router.post("/get_service_traffic", async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "connection_link",
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")
    try {
        const { connection_link } = req.body

        if (connection_link.indexOf("type=grpc") > -1) {
            const email = connection_link.slice(-9)
            const selected_service = await Service.findOne({ grpc_client_email: email })
            const { server_id } = selected_service
            const data = await all_servers.get_client_data({ server_id, client_email: email })
            const { total, up, down, expiryTime } = data[0]
            return res_handler.success(res, "", {
                total: total,
                used: up + down,
                expiryTime
            })
        }

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
    catch (err) {
        console.log({ err });
        return res_handler.failed(res, "INVALID_LINK")
    }
})



router.post("/add_ticket", midels.check_client, (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "message",
            "title"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")

    const { user, message, title } = req.body
    const new_ticket = {
        ticket_id: uid(5),
        creator_id: user.user_id,
        title,
        start_date: Date.now(),
        messages: [{
            sender: false,
            msg: message,
            date: Date.now()
        }],
        status: false
    }

    new Ticket(new_ticket).save()
    res_handler.success(res, "پیام شما ثبت شد و به زودی پاسخ داده خواهد شد", {})


})



router.post("/change_password", midels.check_client, async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "cur_pass",
            "new_pass"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.failed(res, "INVALID_INPUTS")

    const { cur_pass, new_pass, user } = req.body
    const { user_id } = user
    const is_correct = await User.findOne({ user_id, password: shortHash(cur_pass) })
    if (!is_correct) return res_handler.failed(res, "INVALID_PASSWORD")
    await User.findOneAndUpdate({ user_id }, { $set: { password: shortHash(new_pass) } })
    res_handler.success(res, "پسورد شما تغییر کرد")
})



module.exports = router