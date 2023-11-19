require('dotenv').config()
const express=require("express")
const bodyParser=require("body-parser")
const http=require("http")
const mongoose=require("mongoose")
const users = require('./db/users')
const app=express()
app.use(bodyParser.json())
const server=http.createServer(app)
mongoose.connect(process.env.DB)
const port=process.env.PORT


const routs=require("./container/routs")
const keys=Object.keys(routs)
keys.forEach(key=>app.use(key,routs[key]))

server.listen(port,()=>{console.log(`server run on port ${port}`);})