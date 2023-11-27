const { default: axios } = require("axios")
axios.defaults.withCredentials = true
const crypto = require("crypto")
const { uid } = require("uid")
const helper = require("./helper")
const Server = class {
    constructor(server) {
        const { url, user_name, password } = server
        this.url = url
        this.user_name = user_name
        this.password = helper.decrypt(password)
    }
    async init_server() {
        const data = await axios.post(`${this.url}/login`, {
            username: this.user_name,
            password: this.password
        })

        const cookie = data.headers["set-cookie"].splice("session=")[1].split(";")[0]

        this.cookie = cookie

        const get_request = async (path) => {
            const { data } = await axios.get(`${this.url}/${path}`, {
                headers: {
                    "Cookie": cookie
                }
            })
            const { obj } = data
            const is_array = obj.length
            const clean_data = is_array ? obj : [obj].map(e => {
                const keys = Object.keys(e)
                const clean_d = {}
                keys.forEach(k => {
                    try {
                        clean_d[k] = JSON.parse(e[k])
                    } catch {
                        clean_d[k] = e[k]
                    }
                })
                return clean_d
            })
            return clean_data

        }

        const post_request = async (path, payload) => {
            let data = await axios.post(`${this.url}/${path}`, payload, {
                headers: {
                    "Cookie": cookie
                }
            })
            data = data.data
            if(!data.obj)return {data:data.success}
            const { obj } = data
            const is_array = obj.length

            const clean_data = is_array ? obj : [obj].map(e => {
                const keys = Object.keys(e)
                const clean_d = {}
                keys.forEach(k => {
                    try {
                        clean_d[k] = JSON.parse(e[k])
                    } catch {
                        clean_d[k] = e[k]
                    }
                })
                return clean_d
            })
            return clean_data

        }

        this.get_request = get_request
        this.post_request = post_request

    }

    async create_service({ expire_date, flow, name, protocol }) {

        const body = { ...create_server_default }
        body.total = 0
        body.protocol = protocol
        body.expiryTime = expire_date
        body.settings.clients[0].id = crypto.randomUUID()
        body.settings.clients[0].email = uid(9)
        body.settings.clients[0].totalGB =flow * (1024 ** 3)
        body.port = Math.floor(Math.random() * (49999 - 10000) + 10000)
        body.remark = name
        const clean_body = {}
        const keys = Object.keys(body)
        keys.forEach(k => {
            if (typeof body[k] === "object") {
                clean_body[k] = JSON.stringify(body[k], null, 2)
                // clean_body[k] = body[k]
            } else {
                clean_body[k] = body[k]
            }
        })

        const data = await this.post_request("panel/api/inbounds/add", clean_body)
        return data[0]

    }

    clean_to_send(body) {
        const clean_body = {}
        const keys = Object.keys(body)
        keys.forEach(k => {
            if (typeof body[k] === "object") {
                clean_body[k] = JSON.stringify(body[k], null, 2)
                // clean_body[k] = body[k]
            } else {
                clean_body[k] = body[k]
            }
        })
        return clean_body
    }

    async edit_service_name({ name, service_id_on_server }) {
        const cur_status = await this.get_service({ service_id: service_id_on_server })
        if (!cur_status) return false
        const new_body = { ...cur_status }
        const to_delete = ["id", "up", "down", "total", "clientStats"]
        to_delete.forEach(e => delete new_body[e])
        new_body["remark"] = name
        const result = await this.post_request("panel/api/inbounds/update/" + service_id_on_server, this.clean_to_send(new_body))
        return result[0] || false
    }


    async delete_service({ service_id_on_server }) {
        await this.post_request("panel/api/inbounds/del/" + service_id_on_server)
        return true
    }

    async edit_link({ service_id_on_server, client }) {

        const cur_id = client.id
        const new_id = crypto.randomUUID()
        const new_client = { ...client }
        new_client.id = new_id
        const clients_to_send = {clients:[{...new_client}]}
        const result = await this.post_request("panel/api/inbounds/updateClient/" + cur_id, this.clean_to_send(
            {
                id: service_id_on_server,
                settings: clients_to_send
            }
        ))
        return result

    }

    async reset_service({ service_id_on_server,new_ex_date }) { 
        await this.post_request("panel/api/inbounds/resetAllClientTraffics/"+service_id_on_server)
        const cur_status = await this.get_service({ service_id: service_id_on_server })
        if (!cur_status) return false
        const new_body = { ...cur_status }
        const to_delete = ["id", "up", "down", "total", "clientStats"]
        to_delete.forEach(e => delete new_body[e])
        new_body["expiryTime"] = new_ex_date
        new_body["enable"] = true
        const result = await this.post_request("panel/api/inbounds/update/" + service_id_on_server, this.clean_to_send(new_body))
        return result[0] || false
    }

    async get_service({ service_id }) {
        const data = await this.get_request("panel/api/inbounds/get/" + service_id)
        return data[0]
    }

    async get_service_qr_code({ service_id }) { }

    async get_all_services() { }

    async disable_enable_service({ service_id_on_server, op }) {
        const cur_status = await this.get_service({ service_id: service_id_on_server })
        if (!cur_status) return false
        const new_body = { ...cur_status }
        const to_delete = ["id", "up", "down", "total", "clientStats"]
        to_delete.forEach(e => delete new_body[e])
        new_body["enable"] = op
        const result = await this.post_request("panel/api/inbounds/update/" + service_id_on_server, this.clean_to_send(new_body))
        return result[0] || false
    }


}


module.exports = Server



const create_server_default = {
    up: 0,
    down: 0,
    total: 12884901888,
    remark: "test",
    enable: true,
    expiryTime: 1701245630520,
    listen: "",
    port: 29191,
    protocol: "vless",
    settings: {
        clients: [
            {
                "id": "0ed852a9-f414-4e03-b308-b6b9afb4f60a",
                "flow": "",
                "email": "y2il0wiu",
                "limitIp": 0,
                "totalGB": 0,
                "expiryTime": 0,
                "enable": true,
                "tgId": "",
                "subId": "cr3wbwj9cdtu8lnl"
            }
        ],
        "decryption": "none",
        "fallbacks": []
    },
    streamSettings: {
        "network": "tcp",
        "security": "none",
        "tcpSettings": {
            "acceptProxyProtocol": false,
            "header": {
                "type": "http",
                "request": {
                    "method": "GET",
                    "path": [
                        "/"
                    ],
                    "headers": {
                        "Host": [
                            "speedtest.net"
                        ]
                    }
                },
                "response": {
                    "version": "1.1",
                    "status": "200",
                    "reason": "OK",
                    "headers": {}
                }
            }
        }
    },
    "sniffing": {
        "enabled": true,
        "destOverride": [
            "http",
            "tls",
            "quic",
            "fakedns"
        ]
    }
}