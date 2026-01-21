import polka from 'polka';
import { handler } from 'HANDLER';
import { createCompressionMiddleware, createStaticMiddleware } from 'MIDDLEWARES';

const app = polka();

// Serve static assets (use optimized static middleware)
app.use(createStaticMiddleware('client'));

// Serve prerendered pages if they exist
try {
    const { existsSync } = await import('node:fs');
    if (existsSync('prerendered')) {
        app.use(createStaticMiddleware('prerendered', false));
    }
} catch (e) {
    // Skip if prerendered doesn't exist
}

// Register compression for dynamic responses
// app.use(createCompressionMiddleware());

// Handle all SvelteKit requests
app.use(handler);

// Get port and host from environment
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Start server
app.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`\n✓ Server running on http://${displayHost}:${PORT}\n`);
});

// Export for instrumentation
export const path = '/';
export const host = HOST;
export const port = PORT;
export const server = app.server;
