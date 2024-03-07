require('dotenv').config()
const express = require("express")
const bodyParser = require("body-parser")
const http = require("http")
const mongoose = require("mongoose")
const cors = require("cors")
const { CronJob } = require("cron");
const Service = require("./db/service")
const Server = require("./db/server")
const Activity = require("./db/activites")
const Transaction = require("./db/transaction")
const app = express()
app.use(cors())

app.use(bodyParser.json())
const server = http.createServer(app)
mongoose.connect(process.env.DB)
const port = process.env.PORT

const routs = require("./container/routs")
const all_servers = require('./container/all_servers')
const helper = require('./container/helper')
const midels = require('./container/midel')
const res_handler = require('./container/res_handler')
const axios = require('axios')
const User = require('./db/users')
const { uid } = require('uid')
const Notification = require('./db/notification')
const keys = Object.keys(routs)
keys.forEach(key => app.use(key, routs[key]))


all_servers.init_all_servers().then(() => {
    server.listen(port, () => { console.log(`server run on port ${port}`); })
})




const delete_dep_services = async () => {
    const past_7_day = Date.now() - (1000 * 60 * 60 * 24 * 7)
    const services = await Service.find({ end_date: { $lt: past_7_day, $ne: 0 }, delete: false })
    const promises = services.map(async service => {
        const { client_email, service_id_on_server, server_id, name, creator_id } = service
        helper.add_activity(`سرویس ${name} به دلیل عدم تمدید پس از ۷ روز منقضی و حذف شد`, creator_id)
        await all_servers.delete_service({ service_id_on_server, client_email, server_id })
        await Server.findOneAndUpdate({ server_id }, { $inc: { capacity_used: -1 } })
        await Service.findOneAndUpdate({ client_email }, { $set: { delete: true } })
    })
    await Promise.all(promises)
}


const job_1 = new CronJob("0 0 * * *", delete_dep_services)
job_1.start()



const delete_dep_logs = async () => {
    const past_m = Date.now() - (1000 * 60 * 60 * 24 * 30)
    await Activity.deleteMany({ date: { $lt: past_m } })
    await Transaction.deleteMany({ date: { $lt: past_m } })
}

const job_2 = new CronJob("0 0 * * *", delete_dep_logs)
job_2.start()



const check_services_status = async () => {
    const services = await Service.find({ delete: false, active: true })
    for (let service of services) {
        const { service_id_on_server, client_email, server_id } = service
        const server_side_data = await all_servers.get_service_data({ server_id, service_id_on_server, client_email })
        const { expiryTime, up, down, total } = server_side_data
        if ((expiryTime < Date.now() && expiryTime != 0) || (up + down >= total)) {
            all_servers.disable_enable_service({
                server_id, service_id_on_server, op: false, client_email
            })
        }
    }
}



const job_3 = new CronJob("0 * * * *", check_services_status)

job_3.start()


app.get("/reset_servers", midels.check_admin, async (req, res) => {
    await all_servers.init_all_servers()
    await Service.updateMany({ end_date: { $gt: Date.now() - (1000 * 60 * 60 * 24 * 7) } }, { $set: { delete: false } })
    await check_services_status()
    res_handler.success(res, "سرور ها ری استارت شدند")
})



app.get("/sub/:client_email", async (req, res) => {
    try {
        const { client_email } = req.params
        const selected_service = await Service.findOne({ client_email })
        const { server_id, service_id_on_server } = selected_service
        const service_data = await all_servers.get_all_services({ server_id })
        const selected_inbound = service_data.find(e => e.id === service_id_on_server)
        const { clients } = selected_inbound.settings
        const { clientStats } = selected_inbound
        const client_info = clientStats.find(e => e.email === client_email)
        const { total, up, down, expiryTime } = client_info
        const selected_client = clients.find(e => e.email === client_email)
        if (!selected_client) {
            res.send("Service Not Fond")
            return
        }
        const selected_server = await Server.findOne({ server_id })
        const { url, sub_port } = selected_server
        //todo : add sub port
        const Url = new URL(url)
        const prot = Url.port
        const true_url = url.replace(`:${prot || "80"}`, "") + `:${sub_port}/sub/` + selected_client.subId
        const { data: sub } = await axios.get(true_url)
        res.set('Content-Type', ' text/plain; charset=utf-8');
        res.set('Profile-Title', selected_client.subId);
        res.set("Subscription-Userinfo", `upload=${up}; download=${down}; total=${total}; expire=${expiryTime}`)
        res.send(sub)
    }
    catch (err) {
        res.send(err)
    }
})


const detect_direct_services = async () => {
    const services = await Service.find({ protocol: { $ne: "tunnel" }, active: true, delete: false, start_date: { $gt: 1708356890918 } })
    for (const service of services) {
        const { service_id, service_id_on_server, creator_id, credit, server_id, name, client_email } = service
       try{
        await all_servers.delete_service({
            server_id, service_id_on_server, client_email
        })
        await User.findOneAndUpdate({ user_id: creator_id }, { $inc: { credit: credit } })
        const new_notif = {
            rasivers: [creator_id],
            date: Date.now(),
            note: `سرویس ${name} غیر فعال شد و هزینه سرویس به شما برگشت داده شد`,
            notification_id: uid(6)
        }
        new Notification(new_notif).save()
        console.log(`delete ${name}`);
        await Service.findOneAndUpdate({ service_id }, { $set: { active: false, delete: true } })
       }
       catch{
        console.log(`error ${server_id}`);
       }
    }
}

