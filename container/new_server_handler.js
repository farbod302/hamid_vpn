const { default: axios } = require("axios")
axios.defaults.withCredentials = true
const crypto = require("crypto")
const { uid } = require("uid")
const helper = require("./helper")
const Service = require("../db/service")
const Server = class {
    constructor(server) {
        const { url, user_name, password, server_id, grpc_id, tunnel_id } = server
        this.url = url
        this.user_name = user_name
        this.password = helper.decrypt(password)
        this.server_id = server_id
        this.grpc_id = grpc_id
        this.tunnel_id = tunnel_id
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
        this.detect_protocols()

    }

    async detect_protocols() {
        const inbounds = await this.get_request(`panel/api/inbounds/list`)
        let protocols = []
        for (let bound of inbounds) {
            const { remark, id } = bound
            let protocol
            if (remark.indexOf("ws") > -1) protocol = "ws"
            if (remark.indexOf("grpc") > -1) protocol = "grpc"
            if (remark.indexOf("tunnel") > -1) protocol = "tunnel"
            protocols.push({ protocol, id })
        }
        this.protocols = protocols
    }
    async get_all_services() {
        const data = await this.get_request("panel/api/inbounds/list")
        return data
    }


    async get_client_data({ client_email }) {
        const data = await this.get_request("panel/api/inbounds/getClientTraffics/" + client_email)
        return data
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



    async create_service({ expire_date, flow, name, protocol }) {
        const new_client = {
            ...create_server_default.settings
        }
        const client_email = `${name}-${uid(4)}`
        new_client.clients[0].id = crypto.randomUUID()
        new_client.clients[0].email = client_email
        new_client.clients[0].totalGB = flow * (1024 ** 3)
        new_client.clients[0].expiryTime = expire_date
        new_client.clients[0].subId = name
        const s_protocol = this.protocols.find(e => e.protocol === protocol)

        await this.post_request("panel/inbound/addClient", this.clean_to_send({
            settings: { clients: new_client.clients },
            id: s_protocol.id,
            client_email
        }))
        return { id: s_protocol.id, expiryTime: expire_date, protocol, client_email }
    }

    async edit_service_name({ name, service_id_on_server, client_email }) {
        const cur_status = await this.get_request(`panel/api/inbounds/get/${service_id_on_server}`)
        if (!cur_status) return false
        const clients = [...cur_status[0].settings.clients]
        const selected_client = clients.find(e => e.email === client_email)
        const new_email = `${name}-${uid(4)}`
        selected_client["email"] = new_email
        const new_body = {
            id: service_id_on_server,
            settings: { clients: [{ ...selected_client }] }
        }
        const result = await this.post_request(`panel/api/inbounds/updateClient/${selected_client.id}`, this.clean_to_send(new_body))
        return result.data ? new_email : false
    }

    async get_client_uid(client_email) {
        const selected_service = await Service.findOne({ client_email })
        const { service_id_on_server } = selected_service
        const inbound_data = await this.get_request(`panel/api/inbounds/get/${service_id_on_server}`)
        const { clients } = inbound_data[0].settings
        const selected_user = clients.find(cl => cl.email === client_email)
        return { id: selected_user.id }
    }


    async delete_service({ service_id_on_server, client_email }) {

        const { id } = await this.get_client_uid(client_email)
        await this.post_request(`panel/inbound/${service_id_on_server}/delClient/${id}`)
        return true

    }


    async get_service({ client_email, service_id_on_server }) {
        const services = await this.get_request(`panel/api/inbounds/list`)
        console.log({ client_email, service_id_on_server });
        const { clientStats, settings } = services.find(e => e.id === service_id_on_server)
        const { clients } = settings
        const client_status = clients.find(e => e.email === client_email)
        const { enable } = client_status
        const selected_client = clientStats.find(e => e.email === client_email)
        const { up, down, expiryTime, total, id } = selected_client
        const server_side_data = {
            name: client_email,
            id,
            port: "",
            total,
            enable,
            up, down, expiryTime
        }
        return server_side_data
    }


    async disable_enable_service({ client_email, service_id_on_server, status }) {
        const cur_status = await this.get_request(`panel/api/inbounds/get/${service_id_on_server}`)
        if (!cur_status) return false
        const clients = [...cur_status[0].settings.clients]
        const selected_client = clients.find(e => e.email === client_email)

        selected_client["enable"] = status
        const new_body = {
            id: service_id_on_server,
            settings: { clients: [{ ...selected_client }] }
        }
        const result = await this.post_request(`panel/api/inbounds/updateClient/${selected_client.id}`, this.clean_to_send(new_body))
        return result.data ? true : false
    }


    async reset_service({ service_id_on_server, new_ex_date, client_email, volume }) {
        const cur_status = await this.get_request(`panel/api/inbounds/get/${service_id_on_server}`)
        const { clients } = cur_status[0].settings
        const selected_client = clients.find(e => e.email === client_email)
        const new_client = { ...selected_client }
        new_client.expiryTime = new_ex_date
        new_client.totalGB = (volume * (1024 ** 3))
        await this.post_request(`panel/inbound/updateClient/${selected_client.id}`, this.clean_to_send({
            id: service_id_on_server,
            settings: {
                clients: [new_client]
            }
        }))
        await this.post_request(`panel/inbound/${service_id_on_server}/resetClientTraffic/${client_email}`)
        return true
    }

    async edit_link({ service_id_on_server, client_email }) {
        const cur_status = await this.get_request(`panel/api/inbounds/get/${service_id_on_server}`)
        const { clients } = cur_status[0].settings
        const selected_client = clients.find(e => e.email === client_email)
        const new_client = { ...selected_client }
        const cur_id = selected_client.id
        const new_id = crypto.randomUUID()
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
                            "rh.netfan.top"
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