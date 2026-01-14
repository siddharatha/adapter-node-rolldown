import polka from 'polka';
import sirv from 'sirv';
import { handler } from 'HANDLER';

const app = polka();

// Serve static assets
app.use(sirv('client', {
    etag: true,
    maxAge: 31536000,
    immutable: true,
    gzip: true,
    brotli: true
}));

// Serve prerendered pages if they exist
try {
    const { existsSync } = await import('node:fs');
    if (existsSync('prerendered')) {
        app.use(sirv('prerendered', {
            etag: true,
            maxAge: 0
        }));
    }
} catch (e) {
    // Skip if prerendered doesn't exist
}

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
