const Server = require("../db/server")
const ServerClass = require("../container/server_handler")
const all_servers = {


    servers: [],

    async init_all_servers() {
        const all_servers = await Server.find({ active: true })
        for (const server of all_servers) {
            const init_server = new ServerClass(server)
            try {
                await init_server.init_server()
                this.servers.push({
                    server_id: server.server_id,
                    server_class: init_server
                })
            }
            catch {
                continue    
            }
        }
    },

    async create_service({ server_id, flow, expire_date, protocol, name }) {

        const selected_server = this.servers.find(e => e.server_id === server_id)
        if (!selected_server) return false
        const { server_class } = selected_server
        const result = await server_class.create_service({
            expire_date,
            flow,
            name,
            protocol
        })
        return result
    },
    async edit_service_name({ name, server_id, service_id_on_server }) {
        const selected_server = this.servers.find(e => e.server_id === server_id)
        if (!selected_server) return false
        const { server_class } = selected_server

        const result = await server_class.edit_service_name({
            name, service_id_on_server
        })

        return result


    },

    async delete_service({ server_id, service_id_on_server }) {
        const selected_server = this.servers.find(e => e.server_id === server_id)
        if (!selected_server) return false
        const { server_class } = selected_server
        const result = await server_class.delete_service({
            service_id_on_server
        })
        return result
    },

    async get_service_data({ server_id, service_id_on_server }) {
        const selected_server = this.servers.find(e => e.server_id === server_id)
        if (!selected_server) return false
        const { server_class } = selected_server
        const result = await server_class.get_service({
            service_id: service_id_on_server
        })
        return result
    },


    async disable_enable_service({ server_id, service_id_on_server, op }) {
        const selected_server = this.servers.find(e => e.server_id === server_id)
        if (!selected_server) return false
        const { server_class } = selected_server
        const result = await server_class.disable_enable_service({
            service_id_on_server, op
        })
        return result
    },


    async change_link({ server_id, service_id_on_server }) {

        const selected_server = this.servers.find(e => e.server_id === server_id)
        if (!selected_server) return false
        const { server_class } = selected_server

        const service = await this.get_service_data({ server_id, service_id_on_server })
        const { settings } = service
        const client = settings.clients

        const result = await server_class.edit_link({ service_id_on_server, client })
        return result

    },


    async reset_service({ server_id, service_id_on_server, new_ex_date }) {
        const selected_server = this.servers.find(e => e.server_id === server_id)
        if (!selected_server) return false
        const { server_class } = selected_server
        await server_class.reset_service({ service_id_on_server, new_ex_date })
        return { status: true }
    }



}


module.exports = all_servers