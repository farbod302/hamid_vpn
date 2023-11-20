const mongoose = require("mongoose")


const plan = mongoose.Schema({
    plan_id: String,
    dis: String,
    price: String,
    volume: Number,
    duration: Number,
    active: { type: Boolean, default: true }
})


module.exports = mongoose.model("Plan", plan)