const { default: axios } = require("axios")
axios.defaults.withCredentials = true
const crypto = require("crypto")
const { uid } = require("uid")
const helper = require("./helper")
const Service = require("../db/service")
const Server = class {
    constructor(server) {
        const { url, user_name, password, server_id, grpc_id } = server
        this.url = url
        this.user_name = user_name
        this.password = helper.decrypt(password)
        this.server_id = server_id
        this.grpc_id = grpc_id
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
            if (!obj) return data
            const is_array = obj.length
            const clean_data = (is_array ? obj : [obj]).map(e => {
                const keys = Object.keys(e)
                const clean_d = {}
                keys.forEach(k => {
                    try {
                        clean_d[k] = JSON.parse(e[k])
                    } catch (err) {
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
            console.log({ data });
            if (!data.obj) return { data: data.success }
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

    find_port(used) {
        let port = 0
        const generator = () => {
            let rand = Math.floor(Math.random() * (49999 - 10000) + 10000)
            if (used.includes(rand)) generator()
            else {
                port = rand
                return port
            }
        }
        return generator()
    }



    async create_grpc_service({ expire_date, flow, name }) {
        const new_client = {
            ...create_server_default.settings
        }
        const client_email = uid(9)
        new_client.clients[0].id = crypto.randomUUID()
        new_client.clients[0].email = client_email
        new_client.clients[0].totalGB = flow * (1024 ** 3)
        new_client.clients[0].expiryTime = expire_date
        new_client.clients[0].subId = name


        await this.post_request("panel/inbound/addClient", this.clean_to_send({
            settings: { clients: new_client.clients },
            id: this.grpc_id,
            client_email
        }))
        return { id: this.grpc_id, expiryTime: expire_date, is_grpc: true, client_email }
    }


    async create_service({ expire_date, flow, name, protocol }) {
        if (protocol === "grpc") return await this.create_grpc_service({ expire_date, flow, name })
        const cur_services = await this.get_all_services()
        const used_ports = cur_services.map(e => e.port)
        const body = { ...create_server_default }
        body.total = 0
        body.protocol = protocol
        body.expiryTime = expire_date
        body.settings.clients[0].id = crypto.randomUUID()
        body.settings.clients[0].email = uid(9)
        body.settings.clients[0].totalGB = flow * (1024 ** 3)
        body.port = this.find_port(used_ports)
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

    async delete_grpc_service({ service_id_on_server, grpc_client_email }) {
        const get_client = await this.get_service({
            service_id: service_id_on_server,
            is_grpc: true,
            grpc_client_email: grpc_client_email
        })

        const { id } = get_client
        await this.post_request(`panel/inbound/${service_id_on_server}/delClient/${id}`)
        return true

    }

    async edit_link({ service_id_on_server, client }) {

        const cur_id = client.id
        const new_id = crypto.randomUUID()
        const new_client = { ...client }
        new_client.id = new_id
        const clients_to_send = { clients: [{ ...new_client }] }
        const result = await this.post_request("panel/api/inbounds/updateClient/" + cur_id, this.clean_to_send(
            {
                id: service_id_on_server,
                settings: clients_to_send
            }
        ))
        return result

    }

    async reset_service({ service_id_on_server, new_ex_date, is_grpc, grpc_client_email, volume }) {

        if (is_grpc) {
            const cur_status = await this.get_service({ service_id: service_id_on_server })
            console.log({cur_status:cur_status.settings.clients});
            const { clients } = cur_status.settings
            const selected_client = clients.find(e=>e.email === grpc_client_email)
            const new_client = { ...selected_client }
            new_client.expiryTime = new_ex_date
            new_client.totalGB = (volume * (1024 ** 3))
            await this.post_request(`panel/inbound/updateClient/${selected_client.id}`, this.clean_to_send({
                id: service_id_on_server,
                settings: {
                    clients: [new_client]
                }
            }))
            await this.post_request(`panel/inbound/${service_id_on_server}/resetClientTraffic/${grpc_client_email}`)
            return true
        }

        const cur_status = await this.get_service({ service_id: service_id_on_server })
        if (!cur_status) return false
        const new_body = { ...cur_status }
        const to_delete = ["id", "up", "down", "total", "clientStats"]
        to_delete.forEach(e => delete new_body[e])
        new_body["expiryTime"] = new_ex_date
        new_body["enable"] = true
        new_body.settings.clients[0].totalGB = (volume * (1024 ** 3))
        const result = await this.post_request("panel/api/inbounds/update/" + service_id_on_server, this.clean_to_send(new_body))
        await this.post_request("panel/api/inbounds/resetAllClientTraffics/" + service_id_on_server)
        return result[0] || false
    }

    async get_service({ service_id, is_grpc, grpc_client_email }) {
        const data = await this.get_request("panel/api/inbounds/get/" + service_id)
        if (!data[0]) {
            await Service.findOneAndUpdate({ server_id: this.server_id, service_id_on_server: service_id }, { $set: { active: false } })
            return null
        }
        if (is_grpc) {
            const { settings, port } = data[0]
            const selected_client = settings.clients.find(e => e.email === grpc_client_email)
            if (!selected_client) {
                await Service.findOneAndUpdate({ server_id: this.server_id, service_id_on_server: service_id }, { $set: { active: false } })
                return null
            }
            const { subId, totalGB, enable, id } = selected_client
            const client_data = await this.get_request("panel/api/inbounds/getClientTraffics/" + grpc_client_email)
            if (!client_data[0]) return null
            const { up, down, expiryTime } = client_data[0]
            const server_side_data = {
                name: subId,
                id,
                port,
                totalGB,
                enable,
                up, down, expiryTime
            }
            console.log({ server_side_data });
            return server_side_data
        }
        return data[0]
    }


    async get_all_services() {
        const data = await this.get_request("panel/api/inbounds/list")
        return data
    }

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

    async disable_enable_grpc_service({ service_id_on_server, op, client }) {
        const cur_id = client.id
        const new_client = { ...client, enable: op }
        const result = await this.post_request("panel/inbound/updateClient/" + cur_id, this.clean_to_send({
            id: service_id_on_server,
            settings: {
                clients: [new_client]
            }
        }))
        return result
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