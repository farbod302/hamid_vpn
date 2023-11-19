require('dotenv').config()
const express=require("express")
const bodyParser=require("body-parser")
const http=require("http")
const app=express()
app.use(bodyParser)
const server=http.createServer(app)
const port=process.env.PORT
server.listen(port,()=>{console.log(`server run on port ${port}`);})