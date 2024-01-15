require('dotenv').config()
const express = require("express")
const bodyParser = require("body-parser")
const http = require("http")
const mongoose = require("mongoose")
const cors = require("cors")
const { CronJob } = require("cron");
const Service = require("./db/service")
const app = express()
app.use(cors())

app.use(bodyParser.json())
const server = http.createServer(app)
mongoose.connect(process.env.DB)
const port = process.env.PORT

const routs = require("./container/routs")
const all_servers = require('./container/all_servers')
const helper = require('./container/helper')
const keys = Object.keys(routs)
keys.forEach(key => app.use(key, routs[key]))


all_servers.init_all_servers().then(() => {
    server.listen(port, () => { console.log(`server run on port ${port}`); })
})




const delete_dep_services = async () => {
    const past_7_day = Date.now() - (1000 * 60 * 60 * 24 * 7)
    const services = await Service.find({ end_date: { $lt: past_7_day }, delete: false })
    console.log({ services });
    const promises = services.map(async service => {
        const { client_email, service_id_on_server, server_id } = service
        await all_servers.delete_service({ service_id_on_server, client_email, server_id })
        await Service.findOneAndUpdate({ client_email }, { $set: { delete: true } })
    })
    await Promise.all(promises)
}


// const job_1 = new CronJob("0 0 * * *", delete_dep_services())
// job_1.start()

app.get("/", () => {
    delete_dep_services()
})