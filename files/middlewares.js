import compression from 'compression';
import sirv from 'sirv';
import { config } from 'ENV';

/**
 * Create compression middleware with optimized settings
 */
export function createCompressionMiddleware() {
    if (!config.compression) {
        return (req, res, next) => next();
    }

    return compression({
        level: config.compressionLevel,
        threshold: 1024, // Only compress responses > 1KB
        memLevel: 8,
        filter: (req, res) => {
            const contentType = res.getHeader('Content-Type');

            // Don't compress images, videos, or already compressed content
            if (contentType && (
                contentType.includes('image/') ||
                contentType.includes('video/') ||
                contentType.includes('audio/') ||
                contentType.includes('font/')
            )) {
                return false;
            }

            // Use default compression filter for everything else
            return compression.filter(req, res);
        }
    });
}

/**
 * Create static file serving middleware with optimized settings
 */
export function createStaticMiddleware(dir, precompressed = true) {
    return sirv(dir, {
        dev: false,
        etag: true,
        maxAge: 31536000, // 1 year for immutable assets
        immutable: true,
        gzip: precompressed, // Serve .gz files if available
        brotli: precompressed, // Serve .br files if available
        setHeaders: (res, pathname) => {
            // Cache control based on file type
            if (pathname.includes('immutable')) {
                res.setHeader('Cache-Control', 'public, immutable, max-age=31536000');
            } else if (pathname.endsWith('.html')) {
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            } else {
                res.setHeader('Cache-Control', 'public, max-age=3600');
            }
        }
    });
}

/**
 * Simple body parser for JSON and URL-encoded data with configurable limits
 */
export function createBodyParser() {
    const limitBytes = parseLimit(config.bodyLimit);

    return (req, res, next) => {
        // Skip if not a body method
        if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
            return next();
        }

        // Skip if body already parsed
        if (req.body) {
            return next();
        }

        const contentType = req.headers['content-type'] || '';

        // Skip if not JSON or form data (SvelteKit will handle FormData/multipart)
        if (!contentType.includes('application/json') &&
            !contentType.includes('application/x-www-form-urlencoded')) {
            return next();
        }

        let data = '';
        let size = 0;

        req.on('data', chunk => {
            size += chunk.length;
            if (size > limitBytes) {
                req.removeAllListeners('data');
                req.removeAllListeners('end');
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request body too large' }));
                return;
            }
            data += chunk.toString();
        });

        req.on('end', () => {
            try {
                if (contentType.includes('application/json')) {
                    req.body = data ? JSON.parse(data) : {};
                } else if (contentType.includes('application/x-www-form-urlencoded')) {
                    req.body = parseUrlEncoded(data);
                }
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request body' }));
                return;
            }
            next();
        });

        req.on('error', (error) => {
            console.error('Body parse error:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request error' }));
        });
    };
}

/**
 * Parse size limit string to bytes
 */
function parseLimit(limit) {
    if (typeof limit === 'number') return limit;

    const match = limit.match(/^(\d+(?:\.\d+)?)\s*(kb|mb|gb)?$/i);
    if (!match) return 10 * 1024 * 1024; // Default 10MB

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'b').toLowerCase();

    const multipliers = {
        b: 1,
        kb: 1024,
        mb: 1024 * 1024,
        gb: 1024 * 1024 * 1024
    };

    return value * (multipliers[unit] || 1);
}

/**
 * Parse URL-encoded form data
 */
function parseUrlEncoded(str) {
    const obj = {};
    const pairs = str.split('&');

    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key) {
            const decodedKey = decodeURIComponent(key);
            const decodedValue = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
            obj[decodedKey] = decodedValue;
        }
    }

    return obj;
}
