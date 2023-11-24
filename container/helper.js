const QRCode = require('qrcode')
const helper = {
    check_inputs(require_inputs, body) {
        if (!body) return false
        const body_keys = Object.keys(body)
        return require_inputs.every(input => body_keys.includes(input))
    },
    check_phone(phone) {
        return phone.startsWith("09") && phone.length === 11
    },
    generate_qr_code(text) {
        return new Promise(resolve => {
            QRCode.toDataURL(text, function (err, url) {
                resolve(url)
            })
        })
    }
}


module.exports = helper