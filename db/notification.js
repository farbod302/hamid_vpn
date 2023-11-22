const mongoose = require("mongoose")


const notification = mongoose.Schema({
    notification_id: String,
    rasivers: Array,
    seen_by: {type:Array,default:[]},
    date: Number,
    note: String,
})


module.exports = mongoose.model("Notification", notification)