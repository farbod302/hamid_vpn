const mongoose = require("mongoose")


const activity = mongoose.Schema({
    note: String,
    date: Number,
})


module.exports = mongoose.model("Activity", activity)