const jwt = require("./jwt")
const res_handler = require("./res_handler")

const midels = {
    check_admin(req, res, next) {
        const token = req.headers.token
        if (!token) return res_handler.faild(res, "INVALID_TOKEN")
        const token_data = jwt.verify(token)
        if (!token_data) return res_handler.faild(res, "INVALID_TOKEN")
        const { access } = token_data
        if (access !== 1) return res_handler.faild(res, "ACCESS_DENY")
        req.body.user = token_data
        next()
    },
    check_client(req, res, next) {
        const token = req.headers.token
        if (!token) return res_handler.faild(res, "INVALID_TOKEN")
        const token_data = jwt.verify(token)
        if (!token_data) return res_handler.faild(res, "INVALID_TOKEN")
        req.body.user = token_data

        next()
    }

}

module.exports = midels