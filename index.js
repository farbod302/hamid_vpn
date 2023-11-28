require('dotenv').config()
const express = require("express")
const bodyParser = require("body-parser")
const http = require("http")
const mongoose = require("mongoose")
const users = require('./db/users')
const cors = require("cors")

const app = express()
app.use(cors())

app.use(bodyParser.json())
const server = http.createServer(app)
mongoose.connect(process.env.DB)
const port = process.env.PORT

const routs = require("./container/routs")
const Server = require('./container/server_handler')
const all_servers = require('./container/all_servers')
const keys = Object.keys(routs)
keys.forEach(key => app.use(key, routs[key]))



server.listen(port, () => { console.log(`server run on port ${port}`); })



all_servers.init_all_servers()

