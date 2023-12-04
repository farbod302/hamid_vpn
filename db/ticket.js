const mongoose = require("mongoose")


const ticket = mongoose.Schema({
    ticket_id: String,
    creator_id: String,
    title:String,
    start_date: Number,
    messages: Array,
    status: Boolean,
})


module.exports = mongoose.model("Ticket", ticket)