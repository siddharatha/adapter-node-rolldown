import 'SHIMS';
import { Server } from 'SERVER';
import { manifest } from 'MANIFEST';

export const server = new Server(manifest);

await server.init({ env: process.env });

export const handler = async (req, res) => {
    // Let SvelteKit handle the request
    return server.respond(req, res, {
        getClientAddress() {
            return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
        }
    });
};
