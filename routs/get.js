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


router.get("/link/:service_id", async (req, res) => {
    const { service_id } = req.params
    const selected_service = await Service.findOne({ service_id })
    const { client_email, service_id_on_server, protocol, server_id } = selected_service
    const links = {
        grpc: "vless://$id$@cf.w4llbreaker.com:$port$?type=grpc&serviceName=&security=tls&fp=chrome&alpn=http%2F1.1%2Ch2&sni=test.wallbreaker.ir#grpc-$email$",
        tunnel: "vless://$id$@$server_url$:$port$?type=tcp&path=%2F&host=rh.w4llbreaker.com&headerType=http&security=none#tunnel-$email$",
        ws: "vless://$id$@cf.w4llbreaker.com:$port$?type=ws&path=%2F&host=test.wallbreaker.ir&security=tls&fp=chrome&alpn=h2%2Chttp%2F1.1&sni=test.wallbreaker.ir#ws-$email$"
    }
    const service_data = await all_servers.get_all_services({ server_id })

    const selected_inbound = service_data.find(e => e.id === service_id_on_server)
    const { port, settings } = selected_inbound
    const { clients } = settings
    const selected_client = clients.find(e => e.email === client_email)
    const { id } = selected_client
    const server_info = await Server.findOne({ server_id })
    const { url } = server_info
    const keys_to_replace = [
        {
            key: "port",
            value: port
        },
        {
            key: "server_url",
            value: url.replace("http://","").replace("https://","")
        },
        {
            key: "email",
            value: client_email
        },
        {
            key: "id",
            value: id
        }

    ]
    const temp_link = links[protocol]
    const splitted = temp_link.split(/[$$]/i)

    keys_to_replace.forEach(k => {
        const index = splitted.indexOf(k.key)
        if (index === -1) return
        splitted[index] = k.value

    })
    const connection_url = splitted.join("")
    const qr_code = await helper.generate_qr_code(connection_url)
    res_handler.success(res, "", {
        link: connection_url,
        qrcode: qr_code
    })
})




router.get("/servers", async (req, res) => {
    const servers = await Server.find({ delete: false }, { password: 0 })
    res_handler.success(res, "", { servers })
})
router.get("/plans", async (req, res) => {
    const plans = await Plan.find({ delete: false })
    res_handler.success(res, "", { plans })
})



router.get("/add_service_dropdown", async (req, res) => {
    const servers = await Server.find({ active: true, delete: false }, { password: 0 })
    const plans = await Plan.find({ active: true, delete: false })
    res_handler.success(res, "", { plans, servers })
})

router.get("/services", midels.check_client, async (req, res) => {
    const { user } = req.body
    const { user_id, access } = user
    const query = access == 1 ? { active: true, delete: false } : { creator_id: user_id, active: true, delete: false }

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
        const { server_id, service_id_on_server, is_grpc, client_email } = service
        const server_side_data = await all_servers.get_service_data({ server_id, service_id_on_server, is_grpc, client_email })
        console.log({ server_side_data });
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
            const { server_side_data, server, user, service_id, protocol, name: true_name } = service
            const { name, up, down, expiryTime: expiry_time, enable, settings } = server_side_data
            const { total } = settings?.clients[0] || server_side_data

            return {
                name,
                true_name,
                server: server[0].dis,
                total_used: ((up + down) / (1024 ** 2)).toFixed(2) + "MB",
                expiry_time,
                active: enable,
                protocol,
                total_volume: (total / (1024 ** 3)).toFixed(2) + "GB",
                creator: user[0].name,
                service_id,
            }
        }
        catch {
            return null
        }


    })


    res_handler.success(res, "", clean_data.filter(e => e))


})


router.get("/clients", midels.check_admin, async (req, res) => {
    const clients = await User.find({ delete: false }, { password: 0 })
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
})


router.get("/seen_notification", midels.check_client, async (req, res) => {
    const { user } = req.body
    const { user_id } = user
    await User.findOneAndUpdate({ user_id }, { $set: { last_notification_seen: Date.now() } })
    res_handler.success(res, "انجام شد", {})
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
        { services_count: await Service.find({ creator_id: user.user_id, active: true, delete: false }).count() },
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


router.get("/inactive_services", midels.check_admin, async (req, res) => {

    const inactive_services = await Service.aggregate([{ $match: { end_date: { $lt: Date.now(), $gt: 0 }, delete: false, active: true } },
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

    const clean_data = inactive_services.map(e => {
        const { name, server, user, service_id, is_grpc, end_date } = e
        return {
            name,
            server: server[0].dis,
            expiry_time: end_date,
            creator: user[0].name,
            service_id,
            is_grpc
        }


    })
    res_handler.success(res, "", clean_data)
})






module.exports = router

