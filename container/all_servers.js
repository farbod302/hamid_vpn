const Server = require("../db/server")
const ServerClass = require("../container/server_handler")
const all_servers = {


    servers: [],

    async init_all_servers() {
        const all_servers = await Server.find({ active: true })
        for (const server of all_servers) {
            const init_server = new ServerClass(server)
            await init_server.init_server()
            this.servers.push({
                server_id: server.server_id,
                server_class: init_server
            })
        }
    },

    async create_service({ server_id, flow, expire_date, protocol, name }) {
       
        const selected_server = this.servers.find(e => e.server_id === server_id)
        if(!selected_server)return false
        const { server_class } = selected_server
        const result = await server_class.create_service({
            expire_date,
            flow,
            name,
            protocol
        })
        return result
    },
    async edit_service_name({name,server_id,server_id_on_server}){
        const selected_server = this.servers.find(e => e.server_id === server_id)
        if(selected_server)return false
        const { server_class } = selected_server

        const result = await server_class.edit_service_name({
            name,server_id_on_server
        })

        return result


    }


    

}


module.exports = all_servers