const mongoose = require("mongoose")


const server = mongoose.Schema({
    server_id: String,
    url: String,
    dis: String,
    user_name: String,
    password: String,
    capacity: Number,
    capacity_used: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    grpc_id: Number,
    delete: { type: Boolean, default: false }

})


module.exports = mongoose.model("Server", server)