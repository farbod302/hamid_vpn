const mongoose = require("mongoose")


const forget_password = mongoose.Schema({
    session_id: String,
    user_id: String,
    used: { type: Boolean, default: false },
    ip: String,
    date: Number
})


module.exports = mongoose.model("ForgetPassword", forget_password)