import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const files = fileURLToPath(new URL('./files', import.meta.url).href);

/**
 * @typedef {Object} AdapterOptions
 * @property {string} [out='build'] - Output directory
 * @property {boolean} [precompress=true] - Pre-compress static assets
 * @property {string} [envPrefix=''] - Prefix for environment variables
 * @property {boolean} [compression=true] - Enable runtime compression
 * @property {number} [compressionLevel=6] - Compression level (1-9)
 * @property {string} [bodyLimit='10mb'] - Body parser size limit
 * @property {boolean} [websocket=true] - Enable WebSocket support
 * @property {string} [websocketPath='/ws'] - WebSocket endpoint path
 * @property {boolean} [telemetry=true] - Enable OpenTelemetry
 * @property {object} [telemetryConfig={}] - Additional telemetry configuration
 * @property {number} [telemetrySampleRate=1.0] - Sampling rate (0.0-1.0)
 * @property {boolean} [healthCheck=true] - Enable health check endpoints
 * @property {number} [gracefulShutdownTimeout=30000] - Graceful shutdown timeout (ms)
 * @property {boolean} [polyfill=true] - Inject global polyfills
 * @property {string[]|((pkg: any) => string[])} [external] - External packages to exclude from bundle. Can be array of package names or function that receives package.json and returns array
 * @property {boolean} [bundleAll=false] - Bundle all dependencies (ignore package.json dependencies)
 * @property {object} [rolldownOptions={}] - Additional rolldown configuration options
 */

/**
 * High-performance SvelteKit adapter for Node.js
 * @param {AdapterOptions} options
 */
export default function (options = {}) {
    const {
        out = 'build',
        precompress = true,
        envPrefix = '',
        compression = true,
        compressionLevel = 6,
        bodyLimit = '1000mb',
        websocket = true,
        websocketPath = '/ws',
        telemetry = true,
        telemetryConfig = {},
        telemetrySampleRate = 1.0,
        healthCheck = true,
        gracefulShutdownTimeout = 30000,
        polyfill = true,
        external,
        bundleAll = false,
        rolldownOptions = {}
    } = options;

    return {
        name: '@sveltejs/adapter-node-rolldown',

        async adapt(builder) {
            const tmp = builder.getBuildDirectory('adapter-node-rolldown');

            builder.rimraf(out);
            builder.rimraf(tmp);
            builder.mkdirp(tmp);

            builder.log.minor('Copying assets');
            builder.writeClient(`${out}/client${builder.config.kit.paths.base}`);
            builder.writePrerendered(`${out}/prerendered${builder.config.kit.paths.base}`);

            if (precompress) {
                builder.log.minor('Compressing assets');
                await Promise.all([
                    builder.compress(`${out}/client`),
                    builder.compress(`${out}/prerendered`)
                ]);
            }

            builder.log.minor('Building server');

            builder.writeServer(tmp);

            writeFileSync(
                `${tmp}/manifest.js`,
                [
                    `export const manifest = ${builder.generateManifest({ relativePath: './' })};`,
                    `export const prerendered = new Set(${JSON.stringify(builder.prerendered.paths)});`,
                    `export const base = ${JSON.stringify(builder.config.kit.paths.base)};`
                ].join('\n\n')
            );

            const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

            /** @type {Record<string, string>} */
            const input = {
                index: `${tmp}/index.js`,
                manifest: `${tmp}/manifest.js`
            };

            // Support for instrumentation files
            if (builder.hasServerInstrumentationFile?.()) {
                input['instrumentation.server'] = `${tmp}/instrumentation.server.js`;
            }

            // Node.js built-in modules (always external)
            const builtins = [
                'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
                'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
                'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
                'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring', 'readline',
                'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events',
                'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
            ];

            // Determine external packages
            let externalPackages = [];
            if (!bundleAll) {
                if (typeof external === 'function') {
                    externalPackages = external(pkg);
                } else if (Array.isArray(external)) {
                    externalPackages = external;
                } else {
                    // Default: use package.json dependencies
                    externalPackages = Object.keys(pkg.dependencies || {});
                }
            }

            // Combine builtins with external packages
            const allExternal = [...new Set([...builtins, ...externalPackages])];

            // Convert to regex patterns for deep exports support
            // Also handle node: prefix for built-ins
            const externalPatterns = allExternal.map((d) =>
                new RegExp(`^(node:)?${d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\/.*)?$`)
            );

            // Bundle the Vite output so deployments only need production dependencies
            // Anything in devDependencies will get included in the bundled code
            // Rolldown has native support for node resolution, CommonJS, and JSON
            const bundle = await rolldown({
                input,
                external: externalPatterns,
                resolve: {
                    conditionNames: ['node', 'import'],
                    ...rolldownOptions.resolve
                },
                cwd: process.cwd(),
                ...rolldownOptions
            });

            await bundle.write({
                dir: `${out}/server`,
                format: 'esm',
                sourcemap: true,
                chunkFileNames: 'chunks/[name]-[hash].js'
            });

            builder.copy(files, out, {
                replace: {
                    ENV: './env.js',
                    HANDLER: './handler.js',
                    MANIFEST: './server/manifest.js',
                    SERVER: './server/index.js',
                    SHIMS: './shims.js',
                    MIDDLEWARES: './middlewares.js',
                    TELEMETRY: './telemetry.js',
                    ENV_PREFIX: JSON.stringify(envPrefix),
                    COMPRESSION_ENABLED: JSON.stringify(compression),
                    COMPRESSION_LEVEL: JSON.stringify(compressionLevel),
                    BODY_LIMIT: JSON.stringify(bodyLimit),
                    WEBSOCKET_ENABLED: JSON.stringify(websocket),
                    WEBSOCKET_PATH: JSON.stringify(websocketPath),
                    TELEMETRY_ENABLED: JSON.stringify(telemetry),
                    TELEMETRY_CONFIG: JSON.stringify(telemetryConfig),
                    TELEMETRY_SAMPLE_RATE: JSON.stringify(telemetrySampleRate),
                    HEALTH_CHECK_ENABLED: JSON.stringify(healthCheck),
                    GRACEFUL_SHUTDOWN_TIMEOUT: JSON.stringify(gracefulShutdownTimeout),
                    POLYFILL: JSON.stringify(polyfill)
                }
            });

            // Support for instrumentation
            if (builder.hasServerInstrumentationFile?.()) {
                builder.instrument?.({
                    entrypoint: `${out}/index.js`,
                    instrumentation: `${out}/server/instrumentation.server.js`,
                    module: {
                        exports: ['path', 'host', 'port', 'server']
                    }
                });
            }

            builder.log.minor('Generating package.json');

            // Required runtime dependencies for the adapter
            const adapterDeps = {
                '@polka/url': '^1.0.0-next.28',
                'polka': '^0.5.2',
                'sirv': '^3.0.2',
                'compression': '^1.7.4'
            };

            // Optional dependencies based on configuration
            if (websocket) {
                adapterDeps['ws'] = '^8.16.0';
            }

            if (telemetry) {
                Object.assign(adapterDeps, {
                    '@opentelemetry/sdk-node': '0.48.0',
                    '@opentelemetry/auto-instrumentations-node': '0.41.0',
                    '@opentelemetry/exporter-trace-otlp-http': '0.48.0',
                    '@opentelemetry/exporter-trace-otlp-grpc': '0.48.0',
                    '@opentelemetry/resources': '1.21.0',
                    '@opentelemetry/semantic-conventions': '1.21.0',
                    '@opentelemetry/api': '1.7.0',
                    'import-in-the-middle': '^1.17.1'
                });
            }

            // Merge user's production dependencies with adapter dependencies
            // This ensures packages like aws-sdk, dynamodb, etc. are installed at runtime
            const userDeps = pkg.dependencies || {};
            const finalDeps = { ...userDeps, ...adapterDeps };

            writeFileSync(
                `${out}/package.json`,
                JSON.stringify(
                    {
                        name: pkg.name || 'sveltekit-app',
                        version: pkg.version || '1.0.0',
                        type: 'module',
                        main: './index.js',
                        engines: {
                            node: pkg.engines?.node || '>=24.12.0'
                        },
                        dependencies: finalDeps
                    },
                    null,
                    2
                )
            );

            builder.log.success(`Adapter complete! Output: ${out}`);
            builder.log.info(`\nTo run the server:\n  cd ${out}\n  npm install\n  node index.js\n`);
        },

        supports: {
            read: () => true,
            instrumentation: () => true
        }
    };
}
