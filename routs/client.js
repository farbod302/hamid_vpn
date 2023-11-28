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









module.exports = router