const express = require("express")
const router = express.Router()
const User = require("../db/users")
const helper = require("../container/helper")
const res_handler = require("../container/res_handler")
var shortHash = require('short-hash');
const { uid } = require("uid")


router.post("/sign_new_client", async (req, res) => {
    const valid_inputs = helper.check_inputs(
        [
            "user_name",
            "password",
            "access",
            "phone",
            "name"
        ], req.body || {}
    )
    if (!valid_inputs) return res_handler.faild(res, "INVALID_INPUTS")
    const { user_name, password, access, phone, name } = req.body
    if (!helper.check_phone(phone)) return res_handler.faild(res, "INVALID_PHONE")
    const is_exist = await User.findOne({ $or: [{ user_name }, { phone }] })
    if (is_exist) return res_handler.faild(res, "DUPLICATE")
    const user_id = uid(6)
    const new_client = {
        user_id,
        user_name,
        password: shortHash(password),
        access,
        phone,
        name
    }
    new User(new_client).save()
    res_handler.succsess(res, "کاربر با موفقیت ثبت شد")
})
// router.post("/add_credit")
// router.post("/block_client")
// router.post("/add_new_server")
// router.post("/edit_server")
// router.post("/add_service")
// router.post("/send_notification")






module.exports = router