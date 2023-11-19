const res_handler = {

    error_codes: {
        "INVALID_TOKEN": "شناسه کاربری نامعتب است ",
        "ACCESS_DENY": "شما دسترسی لازم برای انجام این درخواست را ندارید",
        "AUTH_FAIL": "نام کاربری یا رمز عبور اشتباه است",
        "INVALID_INPUTS": "پر کردن تمامی ورودی ها الزامی است",
        "INVALID_PHONE": "شماه تماس ورودی نامعتبر است",
        "DUPLICATE": "نام کاربری یا شماره تماس تکراری است",
        "INVALID_USER": "کاربری با این مشخصات یافت نشد",
        "NEED_TO_WAIT":"ارسال پیامک بازیابی هر 2 دقیقه یک بار امکان پذیر است",
        "INVALID_SESSION":"شناسه تغییر پسورد نا معتبر است یا قبلا استفاده شده"
    },

    succsess(res, msg, data) {
        res.json({
            status: true,
            msg,
            data: data || {}
        })
    },

    faild(res, code) {
        res.json({
            status: false,
            msg: this.error_codes[code],
            data: {}
        })
    }
}

module.exports = res_handler