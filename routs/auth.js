const express = require("express")
const helper = require("../container/helper")
const res_handler = require("../container/res_handler")
const router = express.Router()
const User = require("../db/users")
const ForgetPassword = require("../db/forget_password")
var shortHash = require('short-hash');
const jwt = require("../container/jwt")
const { uid } = require("uid")

router.post("/log_in", async (req, res) => {
    if (!helper.check_inputs(["user_name", "password"], req.body)) return res_handler.faild(res, "INVALID_INPUTS")
    const { user_name, password } = req.body
    const selected_user = await User.findOne({
        user_name,
        password: shortHash(password)
    })
    if (!selected_user) return res_handler.faild(res, "AUTH_FAIL")
    const { access, name, user_id, active } = selected_user
    if (!active)return  res_handler.faild(res, "BLOCKED_USER")
        res_handler.succsess(res, "خوش آمدید", jwt.sign({ access, name, user_id }))
})




router.post("/forget_password", async (req, res) => {
    if (!helper.check_inputs(["phone"], req.body)) return res_handler.faild(res, "INVALID_INPUTS")
    const { phone } = req.body
    if (!helper.check_phone(phone)) return res_handler.faild(res, "INVALID_PHONE")
    const selectd_user = await User.findOne({ phone })
    const cant_send = await ForgetPassword.findOne({ ip: req.ip, date: { $gt: Date.now() - 1000 * 60 * 2 } })
    if (cant_send) return res_handler.faild(res, "NEED_TO_WAIT")
    if (!selectd_user) return res_handler.faild(res, "INVALID_USER")
    const session_id = uid(8)
    const new_session = {
        session_id: session_id,
        user_id: selectd_user.user_id,
        date: Date.now(),
        ip: req.ip
    }
    new ForgetPassword(new_session).save()
    //send link with sms
    return res_handler.succsess(res, "لینک بازیابی رمزعبور به شما شماره تماس شما پیامک  شد")
})



router.post("/change_password_session", async (req, res) => {
    if (!helper.check_inputs(["session_id", "new_password"], req.body)) return res_handler.faild(res, "INVALID_INPUTS")
    const { session_id, new_password } = req.body
    const selected_session = await ForgetPassword.findOne({ session_id, used: false })
    if (!selected_session) return res_handler.faild(res, "INVALID_SESSION")
    const { user_id } = selected_session
    await User.findOneAndUpdate({ user_id }, { $set: { password: shortHash(new_password) } })
    await ForgetPassword.findOneAndUpdate({ session_id }, { $set: { used: true } })
    res_handler.succsess(res, "رمز عبور شما با موفقیت تغییر کرد", {})
})


module.exports = router