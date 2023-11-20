const mongoose = require("mongoose")


const transaction = mongoose.Schema({
    transaction_id: String,
    user_id: String,
    credit: Number,
    date: Number,
    note: String,
    creator: String
})


module.exports = mongoose.model("Transaction", transaction)