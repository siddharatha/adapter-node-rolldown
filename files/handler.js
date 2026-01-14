import 'SHIMS';
import { Server } from 'SERVER';
import { manifest } from 'MANIFEST';
import { getRequest, setResponse } from '@sveltejs/kit/node';

export const server = new Server(manifest);

await server.init({ env: process.env });

export const handler = async (req, res) => {
    // Convert Node.js request to Web API Request
    const request = await getRequest({
        request: req,
        base: `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`
    });

    // Let SvelteKit handle the request
    const response = await server.respond(request, {
        getClientAddress() {
            return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
        },
        platform: { req }
    });

    // Write response back to Node.js response
    await setResponse(res, response);
};
