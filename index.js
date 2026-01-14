import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const files = fileURLToPath(new URL('./files', import.meta.url).href);

/**
 * @typedef {Object} AdapterOptions
 * @property {string} [out='build'] - Output directory
 * @property {boolean} [precompress=true] - Pre-compress static assets
 * @property {string} [envPrefix=''] - Prefix for environment variables
 * @property {boolean} [polyfill=true] - Inject global polyfills
 * @property {string[]|((pkg: any) => string[])} [external] - External packages to exclude from bundle
 * @property {object} [rolldownOptions={}] - Additional rolldown configuration options
 */

/**
 * High-performance SvelteKit adapter for Node.js
 * @param {AdapterOptions} options
 */
export default function (options = {}) {
    console.log('Using @siddharatha/adapter-node-rolldown v1.0.4 at 14 jan 16:06');
    const {
        out = 'build',
        precompress = true,
        envPrefix = '',
        polyfill = true,
        external,
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
            // Always include runtime dependencies and user dependencies
            const runtimeDeps = ['polka', 'sirv', '@polka/url'];
            let externalPackages = [...runtimeDeps];

            if (typeof external === 'function') {
                externalPackages = [...externalPackages, ...external(pkg)];
            } else if (Array.isArray(external)) {
                externalPackages = [...externalPackages, ...external];
            } else {
                // Default: use package.json dependencies
                externalPackages = [...externalPackages, ...Object.keys(pkg.dependencies || {})];
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

            // Now copy and bundle the runtime files
            builder.copy(files, `${tmp}/runtime`, {
                replace: {
                    HANDLER: './handler.js',
                    MANIFEST: './server/manifest.js',
                    SERVER: './server/index.js',
                    SHIMS: './shims.js',
                    ENV_PREFIX: JSON.stringify(envPrefix),
                    POLYFILL: JSON.stringify(polyfill)
                }
            });

            // Bundle the runtime files (second pass)
            // Mark the server files as external since they're already bundled
            const runtimeExternalPatterns = [
                ...externalPatterns,
                /^\.\/server\//  // Server files are already bundled, keep them external
            ];

            const runtimeBundle = await rolldown({
                input: {
                    index: `${tmp}/runtime/index.js`
                },
                external: runtimeExternalPatterns,
                resolve: {
                    conditionNames: ['node', 'import'],
                    modulePaths: [
                        fileURLToPath(new URL('./node_modules', import.meta.url)),
                        ...(rolldownOptions.resolve?.modulePaths || [])
                    ],
                    ...rolldownOptions.resolve
                },
                cwd: process.cwd(),
                ...rolldownOptions
            });

            await runtimeBundle.write({
                dir: `${out}`,
                format: 'esm',
                sourcemap: true,
                chunkFileNames: 'chunks/[name]-[hash].js'
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

            // Include adapter runtime dependencies + all user dependencies
            const finalDeps = {
                '@polka/url': '^1.0.0-next.28',
                'polka': '^0.5.2',
                'sirv': '^3.0.2',
                ...(pkg.dependencies || {})
            };

            builder.log.info(`Including ${Object.keys(finalDeps).length} dependencies in output package.json`);

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
