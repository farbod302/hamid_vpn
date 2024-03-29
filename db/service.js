const mongoose = require("mongoose")


const service = mongoose.Schema({
    service_id: String,
    service_id_on_server: Number,
    creator_id: String,
    plan_id: String,
    volume: Number,
    server_id: String,
    protocol: String,
    credit: Number,
    start_date: Number,
    end_date: Number,
    name: String,
    active: { type: Boolean, default: true },
    client_email: { type: String, default: "" },
    delete: { type: Boolean, default: false }

})


module.exports = mongoose.model("Service", service)