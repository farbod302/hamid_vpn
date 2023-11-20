const mongoose = require("mongoose")


const server = mongoose.Schema({
    server_id: String,
    url:String,
    dis: String,
    user_name: String,
    password: String,
    capacity: Number,
    active: { type: Boolean, default: true }
})


module.exports = mongoose.model("Server", server)