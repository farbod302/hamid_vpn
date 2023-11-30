const express = require("express")
const midels = require("../container/midel")
const Service = require("../db/service")
const res_handler = require("../container/res_handler")
const all_servers = require("../container/all_servers")
const Server = require("../db/server")
const User = require("../db/users")
const Plan = require("../db/plan")
const helper = require("../container/helper")
const Notification = require("../db/notification")
const router = express.Router()



router.get("/link/:service_id", midels.check_client, async (req, res) => {
    const { user } = req.body
    const { user_id, access } = user
    const { service_id } = req.params
    const selected_service = await Service.findOne({ service_id })
    if (!selected_service) return res_handler.failed("INVALID_SERVICE")
    if (!access && selected_service.creator_id !== user_id) return res_handler.failed(res, "ACCESS_DENY")
    const { server_id, service_id_on_server } = selected_service
    const service_data = await all_servers.get_service_data({ server_id, service_id_on_server })
    const selected_server = await Server.findOne({ server_id })
    const { url } = selected_server
    const url_parser = new URL(url)
    const { protocol, port, settings, remark } = service_data
    const { clients } = settings
    const connection_user = clients[0]
    const { id, email } = connection_user
    let link, qrcode
    if (protocol === "vless") {
        link = `vless://${id}@${url_parser.hostname}:${port}?type=tcp&path=/&host=speedtest.net&headerType=http&security=none#${remark}-${email}`
        qrcode = await helper.generate_qr_code(link)
    } else {
        const base_data = {
            "v": "2",
            "ps": "",
            "add": "",
            "port": "",
            "id": "",
            "net": "tcp",
            "type": "http",
            "tls": "none",
            "path": "/",
            "host": "speedtest.net"
        }
        base_data["ps"] = remark + "-" + email
        base_data["port"] = port
        base_data["add"] = url_parser.hostname
        base_data["id"] = id
        link = "vmess://" + btoa(JSON.stringify(base_data))
        qrcode = await helper.generate_qr_code(link)
    }
    res_handler.success(res, "", { link, qrcode })

})


router.get("/servers", async (req, res) => {
    const servers = await Server.find({}, { password: 0 })
    res_handler.success(res, "", { servers })
})
router.get("/plans", async (req, res) => {
    const plans = await Plan.find()
    res_handler.success(res, "", { plans })
})



router.get("/add_service_dropdown",async (req,res)=>{
    const servers = await Server.find({}, { password: 0 })
    const plans = await Plan.find()
    res_handler.success(res, "", { plans,servers})
    


})

router.get("/services", midels.check_client, async (req, res) => {
    const { user } = req.body
    const { user_id, access } = user
    const query = access == 1 ? {} : { creator_id: user_id }

    const user_services = await Service.aggregate([{ $match: query },
    {
        $lookup: {
            from: "servers",
            localField: "server_id",
            foreignField: "server_id",
            as: "server"
        }
    },
    {
        $lookup: {
            from: "users",
            localField: "creator_id",
            foreignField: "user_id",
            as: "user"
        }
    },

    ])
    const services_status = user_services.map(async service => {
        const { server_id, service_id_on_server } = service
        const server_side_data = await all_servers.get_service_data({ server_id, service_id_on_server })
        console.log({server_side_data:server_side_data.settings.clients});

        return {
            ...service,
            server_side_data,
        }
    })

    const compleat_data = await Promise.all(services_status)


    const clean_data = compleat_data.map(service => {
        try {
            const { name, server_side_data, server, user,service_id } = service
            const { up, down, expiryTime: expiry_time, enable, port, settings } = server_side_data
            const { totalGB } = settings?.clients[0]
            
            return {
                name,
                server: server[0].dis,
                total_used: ((up + down) / (1024 ** 2)).toFixed(2)+"MB",
                expiry_time,
                active: enable,
                port,
                total_volume: totalGB / (1024 ** 3)+"GB",
                creator: user[0].name,
                service_id
            }
        }
        catch {
            return null
        }


    })


    res_handler.success(res, "", clean_data.filter(e => e))


})


router.get("/clients", midels.check_admin, async (req, res) => {
    const clients = await User.find({}, { password: 0 })
    res_handler.success(res, "", clients)
})


router.get("/notifications", midels.check_client, async (req, res) => {
    const { user } = req.body
    const { user_id } = user
    const user_from_db = await User.findOne({ user_id })
    const { last_notification_seen } = user_from_db
    const user_notifications = await Notification.aggregate([
        {
            $match: { $or: [{ rasivers: "all" }, { rasivers: user_id }] }
        },
        {
            $project: {
                date: "$date",
                note: "$note",
                seen: {
                    $cond: { if: { $gt: ["$date", last_notification_seen] }, then: false, else: true }
                }
            }
        },

    ])
    res_handler.success(res, "", user_notifications)

    await User.findOneAndUpdate({ user_id }, { $set: { last_notification_seen: Date.now() } })
})





module.exports = router

