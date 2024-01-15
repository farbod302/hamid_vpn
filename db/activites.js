const mongoose = require("mongoose")


const activity = mongoose.Schema({
    note: Array,
    date: Number,
})


module.exports = mongoose.model("Activity", activity)