const mongoose = require("mongoose")


const activity = mongoose.Schema({
    note: String,
    date: Number,
    user_id:String
})


module.exports = mongoose.model("Activity", activity)