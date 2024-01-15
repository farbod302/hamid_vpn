const JWT = require("jsonwebtoken")

const jwt = {
    sign(data) {
        return JWT.sign(data, process.env.JWT,{
            expiresIn:"3d"
        })
    },
    verify(token) {
        try {
            return JWT.verify(token, process.env.JWT)
        } catch {
            return false
        }
    }
}

module.exports=jwt