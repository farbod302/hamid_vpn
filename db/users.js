const mongoose = require("mongoose")


const user = mongoose.Schema({
    user_id: String,
    user_name: String,
    password: String,
    name: String,
    phone: String,
    access: Number,
    credit: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    creator: String,
    last_notification_seen: { type: Number, default: 0 }
})


module.exports = mongoose.model("User", user)