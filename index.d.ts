export interface AdapterOptions {
    /**
     * Output directory for the build
     * @default 'build'
     */
    out?: string;

    /**
     * Pre-compress static assets with gzip and brotli
     * @default true
     */
    precompress?: boolean;

    /**
     * Prefix for environment variables
     * @default ''
     */
    envPrefix?: string;

    /**
     * Enable runtime compression middleware
     * @default true
     */
    compression?: boolean;

    /**
     * Compression level (1-9, where 9 is maximum compression)
     * @default 6
     */
    compressionLevel?: number;

    /**
     * Maximum request body size
     * @default '10mb'
     */
    bodyLimit?: string | number;

    /**
     * Enable WebSocket support
     * @default true
     */
    websocket?: boolean;

    /**
     * WebSocket endpoint path
     * @default '/ws'
     */
    websocketPath?: string;

    /**
     * Enable OpenTelemetry tracing
     * @default true
     */
    telemetry?: boolean;

    /**
     * Additional OpenTelemetry configuration
     */
    telemetryConfig?: {
        /**
         * Custom resource attributes
         */
        resourceAttributes?: Record<string, string>;

        /**
         * Custom HTTP headers for exporter
         */
        headers?: Record<string, string>;

        /**
         * Instrumentation-specific configuration
         */
        instrumentations?: Record<string, any>;
    };

    /**
     * Telemetry sampling rate (0.0 to 1.0)
     * @default 1.0
     */
    telemetrySampleRate?: number;

    /**
     * Enable health check endpoints (/health, /readiness)
     * @default true
     */
    healthCheck?: boolean;

    /**
     * Graceful shutdown timeout in milliseconds
     * @default 30000
     */
    gracefulShutdownTimeout?: number;

    /**
     * Inject global polyfills (fetch, Headers, etc.)
     * @default true
     */
    polyfill?: boolean;

    /**
     * External packages to exclude from bundle.
     * Can be an array of package names or a function that receives package.json and returns an array.
     * If not specified, uses package.json dependencies by default.
     * @default undefined
     * @example
     * // Array of package names
     * external: ['polka', 'sirv']
     * 
     * // Function to dynamically determine externals
     * external: (pkg) => [...Object.keys(pkg.dependencies), 'some-other-package']
     */
    external?: string[] | ((pkg: any) => string[]);

    /**
     * Bundle all dependencies (ignore package.json dependencies).
     * When true, all code including node_modules will be bundled.
     * @default false
     */
    bundleAll?: boolean;

    /**
     * Additional rolldown configuration options.
     * These will be merged with the default rolldown config.
     */
    rolldownOptions?: Record<string, any>;
