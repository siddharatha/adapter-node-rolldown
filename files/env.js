/**
 * Environment configuration with sensible defaults
 */
export const config = {
    // Server configuration
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0', // Important: use 0.0.0.0 for containers

    // Performance options
    compression: JSON.parse('COMPRESSION_ENABLED'),
    compressionLevel: JSON.parse('COMPRESSION_LEVEL'),
    bodyLimit: JSON.parse('BODY_LIMIT'),

    // WebSocket configuration
    websocket: {
        enabled: JSON.parse('WEBSOCKET_ENABLED'),
        path: JSON.parse('WEBSOCKET_PATH')
    },

    // OpenTelemetry configuration
    telemetry: {
        enabled: JSON.parse('TELEMETRY_ENABLED') && process.env.OTEL_ENABLED !== 'false',
        serviceName: process.env.OTEL_SERVICE_NAME || 'sveltekit-app',
        serviceVersion: process.env.OTEL_SERVICE_VERSION || '1.0.0',
        endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
        protocol: process.env.OTEL_EXPORTER_OTLP_PROTOCOL || 'http', // 'http' or 'grpc'
        sampleRate: parseFloat(process.env.OTEL_SAMPLE_RATE || JSON.parse('TELEMETRY_SAMPLE_RATE')),
        dynatraceToken: process.env.DYNATRACE_API_TOKEN,
        customConfig: JSON.parse('TELEMETRY_CONFIG')
    },

    // Health check configuration
    healthCheck: {
        enabled: JSON.parse('HEALTH_CHECK_ENABLED')
    },

    // Graceful shutdown
    gracefulShutdownTimeout: JSON.parse('GRACEFUL_SHUTDOWN_TIMEOUT'),

    // Server tuning
    keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT || '65000', 10),
    headersTimeout: parseInt(process.env.HEADERS_TIMEOUT || '66000', 10),
    maxRequestsPerSocket: parseInt(process.env.MAX_REQUESTS_PER_SOCKET || '0', 10),

    // Origin for CORS (if needed)
    origin: process.env.ORIGIN || undefined,

    // XFF header handling (trust proxy)
    trustProxy: process.env.TRUST_PROXY === 'true'
};
