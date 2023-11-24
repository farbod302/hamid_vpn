const express = require("express")
const midels = require("../container/midel")
const Service = require("../db/service")
const res_handler = require("../container/res_handler")
const all_servers = require("../container/all_servers")
const Server = require("../db/server")
const helper = require("../container/helper")
const router = express.Router()



router.get("/link/:service_id", midels.check_client, async (req, res) => {
    const { user } = req.body
    const { user_id, access } = user
    const { service_id } = req.params
    const selected_service = await Service.findOne({ service_id })
    if (!selected_service) return res_handler.faild("INVALID_SERVICE")
    if (!access && selected_service.creator_id !== user_id) return res_handler.faild(res, "ACCESS_DENY")
    const { server_id, service_id_on_server } = selected_service
    const service_data = await all_servers.get_service_data({ server_id, service_id_on_server })
    const selected_server = await Server.findOne({ server_id })
    const { url } = selected_server
    const url_parser = new URL(url)
    const { protocol, port, settings, remark } = service_data
    const { clients } = settings
    const connection_user = clients[0]
    const { id, email } = connection_user
    let link, qrcode
    if (protocol === "vless") {
        link = `vless://${id}@${url_parser.hostname}:${port}?type=tcp&path=/&host=speedtest.net&headerType=http&security=none#${remark}-${email}`
        qrcode = await helper.generate_qr_code(link)
    } else {
        const base_data = {
            "v": "2",
            "ps": "",
            "add": "",
            "port": "",
            "id": "",
            "net": "tcp",
            "type": "http",
            "tls": "none",
            "path": "/",
            "host": "speedtest.net"
        }
        base_data["ps"] = remark + "-" + email
        base_data["port"] = port
        base_data["add"] = url_parser.hostname
        base_data["id"] = id
        link = "vmess://" + btoa(JSON.stringify(base_data))
        qrcode = await helper.generate_qr_code(link)
    }
    res_handler.succsess(res,"", { link, qrcode })

})







module.exports = router