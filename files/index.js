import { createServer } from 'node:http';
import polka from 'polka';
import { config } from 'ENV';
import { initTelemetry, shutdownTelemetry } from 'TELEMETRY';
import { createCompressionMiddleware, createStaticMiddleware, createBodyParser } from 'MIDDLEWARES';
import { handler } from 'HANDLER';

// WebSocket support
let wss = null;
if (config.websocket.enabled) {
    const { WebSocketServer } = await import('ws');
    wss = WebSocketServer;
}

// Track server state
let isShuttingDown = false;
let server = null;
let wsServer = null;

// Export for instrumentation support
export const path = '/';
export let port = config.port;
export let host = config.host;
export { server };

/**
 * Initialize and start the server
 */
async function start() {
    console.log('Starting SvelteKit high-performance server...');

    // Initialize OpenTelemetry first (for request tracing)
    await initTelemetry();

    // Create HTTP server
    server = createServer();

    // Configure server performance settings
    server.keepAliveTimeout = config.keepAliveTimeout;
    server.headersTimeout = config.headersTimeout;
    if (config.maxRequestsPerSocket) {
        server.maxRequestsPerSocket = config.maxRequestsPerSocket;
    }

    // Create Polka app
    const app = polka({ server });

    // Health check endpoints (before other middleware)
    if (config.healthCheck.enabled) {
        app.get('/health', (req, res) => {
            if (isShuttingDown) {
                res.writeHead(503, { 'Content-Type': 'text/plain' });
                res.end('Shutting down');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
        });

        app.get('/readiness', async (req, res) => {
            if (isShuttingDown) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'not ready', reason: 'shutting down' }));
                return;
            }

            // Add custom readiness checks here (database, cache, etc.)
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ready' }));
        });
    }

    // Apply compression middleware
    app.use(createCompressionMiddleware());

    // Apply body parser
    app.use(createBodyParser());

    // Serve prerendered pages and static assets
    app.use(createStaticMiddleware('client', true));
    app.use(createStaticMiddleware('prerendered', false));

    // Handle all other requests with SvelteKit
    app.use((req, res) => {
        // Convert Polka request to format expected by SvelteKit
        handler(req, res);
    });

    // Initialize WebSocket server if enabled
    if (config.websocket.enabled && wss) {
        wsServer = new wss({
            server,
            path: config.websocket.path
        });

        wsServer.on('connection', (ws, req) => {
            console.log(`WebSocket connection established: ${req.url}`);

            ws.on('message', (data) => {
                // Handle WebSocket messages
                // You can add custom logic here or expose via hooks
                try {
                    const message = JSON.parse(data.toString());
                    console.log('WebSocket message:', message);

                    // Echo back for now (customize as needed)
                    ws.send(JSON.stringify({ type: 'echo', data: message }));
                } catch (error) {
                    console.error('WebSocket message error:', error);
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
                }
            });

            ws.on('close', () => {
                console.log('WebSocket connection closed');
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });

            // Send welcome message
            ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
        });

        console.log(`WebSocket server enabled on path: ${config.websocket.path}`);
    }

    // Start listening
    server.listen(config.port, config.host, () => {
        console.log(`\n✓ Server running on http://${config.host}:${config.port}`);
        console.log(`  - Compression: ${config.compression ? 'enabled' : 'disabled'}`);
        console.log(`  - WebSocket: ${config.websocket.enabled ? `enabled (${config.websocket.path})` : 'disabled'}`);
        console.log(`  - OpenTelemetry: ${config.telemetry.enabled ? 'enabled' : 'disabled'}`);
        console.log(`  - Health checks: ${config.healthCheck.enabled ? 'enabled (/health, /readiness)' : 'disabled'}`);
        console.log(`  - Body limit: ${config.bodyLimit}`);
        console.log('');
    });
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
    if (isShuttingDown) {
        console.log('Shutdown already in progress...');
        return;
    }

    isShuttingDown = true;
    console.log(`\n${signal} received, starting graceful shutdown...`);

    // Set a timeout to force shutdown
    const forceShutdownTimer = setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, config.gracefulShutdownTimeout);

    try {
        // Stop accepting new connections
        if (server) {
            await new Promise((resolve) => {
                server.close(() => {
                    console.log('✓ HTTP server closed');
                    resolve();
                });
            });
        }

        // Close WebSocket connections
        if (wsServer) {
            console.log('Closing WebSocket connections...');
            wsServer.clients.forEach((ws) => {
                ws.close(1001, 'Server shutting down');
            });

            await new Promise((resolve) => {
                wsServer.close(() => {
                    console.log('✓ WebSocket server closed');
                    resolve();
                });
            });
        }

        // Shutdown OpenTelemetry and flush traces
        await shutdownTelemetry();

        clearTimeout(forceShutdownTimer);
        console.log('✓ Graceful shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        clearTimeout(forceShutdownTimer);
        process.exit(1);
    }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
