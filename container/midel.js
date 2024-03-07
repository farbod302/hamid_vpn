const Users = require("../db/users")
const jwt = require("./jwt")
const res_handler = require("./res_handler")

const midels = {
    async check_admin(req, res, next) {
        const token = req.headers.token
        if (!token) return res_handler.failed(res, "INVALID_TOKEN")
        const token_data = jwt.verify(token)
        if (!token_data) return res_handler.failed(res, "INVALID_TOKEN")
        const { access, user_id } = token_data
        if (access !== 1) return res_handler.failed(res, "ACCESS_DENY")
        const selected_user = await Users.findOne({ user_id, delete: false, active: true })
        if (!selected_user) return res_handler.failed(res, "INVALID_TOKEN")
        req.body.user = token_data
        next()
    },
    async check_client(req, res, next) {
        const token = req.headers.token
        if (!token) return res_handler.failed(res, "INVALID_TOKEN")
        const token_data = jwt.verify(token)
        if (!token_data) return res_handler.failed(res, "INVALID_TOKEN")
        const { user_id } = token_data
        const selected_user = await Users.findOne({ user_id, delete: false, active: true })
        if (!selected_user) return res_handler.failed(res, "INVALID_TOKEN")
        req.body.user = token_data

        next()
    }

}

module.exports = midels