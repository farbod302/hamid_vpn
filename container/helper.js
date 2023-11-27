const QRCode = require('qrcode')
var encryptor = require('simple-encryptor')(process.env.ENCRYPTOR);

const helper = {
    check_inputs(require_inputs, body) {
        if (!body) return false
        const body_keys = Object.keys(body)
        for(let key of body_keys){
            if(!body[key])return false
        }
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
    },

    encrypt(text) {
        return encryptor.encrypt(text)
    },
    decrypt(hash) {
        return encryptor.decrypt(hash)
    }
}


module.exports = helper