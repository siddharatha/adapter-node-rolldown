/**
 * Environment configuration with sensible defaults
 */
export const config = {
    // Server configuration
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0', // Important: use 0.0.0.0 for containers

    // Performance options
    compression: JSON.parse(process.env.COMPRESSION_ENABLED || 'true'),
    compressionLevel: JSON.parse(process.env.COMPRESSION_LEVEL || '6'),
    bodyLimit: JSON.parse(process.env.BODY_LIMIT || '"100mb"'),

    // WebSocket configuration
    websocket: {
        enabled: JSON.parse(process.env.WEBSOCKET_ENABLED || 'false'),
        path: JSON.parse(process.env.WEBSOCKET_PATH || '"/ws"')
    },

    // OpenTelemetry configuration
    telemetry: {
        enabled: JSON.parse(process.env.TELEMETRY_ENABLED || 'false') && process.env.OTEL_ENABLED !== 'false',
        serviceName: process.env.OTEL_SERVICE_NAME || 'sveltekit-app',
        serviceVersion: process.env.OTEL_SERVICE_VERSION || '1.0.0',
        endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
        protocol: process.env.OTEL_EXPORTER_OTLP_PROTOCOL || 'http', // 'http' or 'grpc'
        sampleRate: parseFloat(process.env.OTEL_SAMPLE_RATE || '0.1'),
        dynatraceToken: process.env.DYNATRACE_API_TOKEN,
        customConfig: JSON.parse(process.env.TELEMETRY_CONFIG || '{}')
    },

    // Health check configuration
    healthCheck: {
        enabled: JSON.parse(process.env.HEALTH_CHECK_ENABLED || 'true')
    },

    // Graceful shutdown
    gracefulShutdownTimeout: JSON.parse(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000'),

    // Server tuning
    keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT || '65000', 10),
    headersTimeout: parseInt(process.env.HEADERS_TIMEOUT || '66000', 10),
    maxRequestsPerSocket: parseInt(process.env.MAX_REQUESTS_PER_SOCKET || '0', 10),

    // Origin for CORS (if needed)
    origin: process.env.ORIGIN || undefined,

    // XFF header handling (trust proxy)
    trustProxy: process.env.TRUST_PROXY === 'true'
};
