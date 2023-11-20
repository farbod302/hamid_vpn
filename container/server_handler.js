const { default: axios } = require("axios")
axios.defaults.withCredentials = true
const qs = require("qs")
const { uid } = require("uid")
const Server = class {
    constructor(server) {
        const { url, user_name, password } = server
        this.url = url
        this.user_name = user_name
        this.password = password
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
            let  data  = await axios.post(`${this.url}/${path}`, payload, {
                headers: {
                    "Cookie": cookie
                }
            })
            console.log(data);
            data=data.data
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

    async create_service({ expire_date, flow, name }) {

        const body = { ...create_server_default }
        body.total = flow * (1024 ** 3)
        body.expiryTime = expire_date
        body.settings.clients[0].id = crypto.randomUUID(32)
        body.settings.clients[0].email =uid(9) 
        body.port = Math.floor(Math.random() * (49999 - 10000) + 10000)
        body.remark = name
        const clean_body = {}
        const keys = Object.keys(body)
        keys.forEach(k => {
            if (typeof body[k] === "object") {
                clean_body[k] =JSON.stringify(body[k],null,2)
                // clean_body[k] = body[k]
            } else {
                clean_body[k] = body[k]
            }
        })

        console.log(clean_body);
        const res = await this.post_request("panel/api/inbounds/add", clean_body)
        console.log(res);

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