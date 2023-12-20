const express = require("express")
const midels = require("../container/midel")
const Service = require("../db/service")
const res_handler = require("../container/res_handler")
const all_servers = require("../container/all_servers")
const Server = require("../db/server")
const User = require("../db/users")
const Plan = require("../db/plan")
const Ticket = require("../db/ticket")
const helper = require("../container/helper")
const Notification = require("../db/notification")
const Transaction = require("../db/transaction")
const router = express.Router()
const fs = require("fs")


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
    let connection_user = clients[0]
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


router.get("/grpc_link/:service_id", async (req, res) => {
    const { service_id } = req.params
    const selected_service = await Service.findOne({ service_id })
    if (!selected_service) return res_handler.failed(res, "INVALID_SERVICE")
    const { service_id_on_server, server_id, grpc_client_email } = selected_service
    const service_data = await all_servers.get_service_data({
        server_id,
        is_grpc: false,
        service_id_on_server

    })

    const selected_server = await Server.findOne({ server_id })
    const { url } = selected_server
    const url_parser = new URL(url)
    const { settings, streamSettings, port, remark } = service_data
    const server_name = service_data.streamSettings.tlsSettings.settings.serverName
    const selected_client = settings.clients.find(e => e.email === grpc_client_email)
    const { id } = selected_client
    const static_str = "?type=grpc&serviceName=&security=tls&fp=chrome&alpn=http%2F1.1%2Ch2&sni="

    const link = `vless://${id}@${streamSettings.tlsSettings.serverName}:${port}${static_str}${server_name}#${remark}-${grpc_client_email}`
    const qrcode = await helper.generate_qr_code(link)
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



router.get("/add_service_dropdown", async (req, res) => {
    const servers = await Server.find({ active: true }, { password: 0 })
    const plans = await Plan.find({ active: true })
    res_handler.success(res, "", { plans, servers })
})

router.get("/services", midels.check_client, async (req, res) => {
    const { user } = req.body
    const { user_id, access } = user
    const query = access == 1 ? { active: true } : { creator_id: user_id, active: true }

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
        const { server_id, service_id_on_server, is_grpc, grpc_client_email } = service
        const server_side_data = await all_servers.get_service_data({ server_id, service_id_on_server, is_grpc, grpc_client_email })
        if (!server_side_data) return null
        return {
            ...service,
            server_side_data,
        }
    })

    let compleat_data = await Promise.all(services_status)
    compleat_data = compleat_data.filter(e => e)

    const clean_data = compleat_data.map(service => {
        try {
            const { name, server_side_data, server, user, service_id, is_grpc } = service
            const { up, down, expiryTime: expiry_time, enable, port, settings } = server_side_data
            const { totalGB } = settings?.clients[0] || server_side_data

            return {
                name,
                server: server[0].dis,
                total_used: ((up + down) / (1024 ** 2)).toFixed(2) + "MB",
                expiry_time,
                active: enable,
                port,
                total_volume: (totalGB / (1024 ** 3)).toFixed(2) + "GB",
                creator: user[0].name,
                service_id,
                is_grpc
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


router.get("/tickets", midels.check_client, async (req, res) => {

    const { user } = req.body
    const query = user.access === 1 ? {} : { creator_id: user.user_id }

    const tickets = await Ticket.aggregate([
        {
            $match: query
        },
        {
            $lookup: {
                from: "users",
                localField: "creator_id",
                foreignField: "user_id",
                as: "creator"
            }
        }
    ])


    const clean_tickets = tickets.map(t => {
        return {
            ...t,
            creator: t.creator[0].name
        }
    })
    res_handler.success(res, "", clean_tickets)


})



router.get("/dashboard", midels.check_client, async (req, res) => {
    const { user } = req.body
    const promises = [
        { credit: await User.findOne({ user_id: user.user_id }, { credit: 1 }) },
        { services_count: await Service.find({ creator_id: user.user_id, active: true }).count() },
        { transactions_count: await Transaction.find({ user_id: user.user_id }).count() }
    ]

    const data = await Promise.all(promises)
    const response = {
        credit: data[0].credit.credit,
        services_count: data[1].services_count,
        transaction_count: data[2].transactions_count
    }
    const admin_note_file = fs.readFileSync(`${__dirname}/../admin_msg.json`)
    const admin_note = JSON.parse(admin_note_file.toString())
    const now = Date.now()
    if (now < admin_note.expire_date) response.admin_note = admin_note.msg
    else response.admin_note = null
    res_handler.success(res, "", response)
})


router.get("/transactions", midels.check_client, async (req, res) => {
    const { user } = req.body
    const { access, user_id } = user
    const query = access === 1 ? {} : { user_id }
    const transactions = await Transaction.aggregate([
        { $match: query },
        {
            $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "user_id",
                as: "user"
            }
        }
    ])
    res_handler.success(res, "", transactions.map(e => { return { ...e, user: e.user[0].name } }))
})





module.exports = router

