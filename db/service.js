const mongoose = require("mongoose")


const service = mongoose.Schema({
    service_id: String,
    creator: String,
    plan: String,
    volume: String,
    server: String,
    protocol:String,
    credit: Number,
    start_date: Number,
    end_date: Number,
    active: { type: Boolean, default: true }
})


module.exports = mongoose.model("Service", service)