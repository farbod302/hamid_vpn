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

        const splitted=connection_link.split("#")
        const email=splitted.slice(-1)[0].split("-").slice(-2).join("-")
        const selected_service = await Service.findOne({ client_email: email })
        const { server_id } = selected_service
        const data = await all_servers.get_client_data({ server_id, client_email: email })
        const { total, up, down, expiryTime } = data[0]
        return res_handler.success(res, "", {
            total: total,
            used: up + down,
            expiryTime
        })
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