const mongoose = require("mongoose")


const activity = mongoose.Schema({
    note: Text,
    date: Number,
})


module.exports = mongoose.model("Activity", activity)