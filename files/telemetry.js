import { config } from 'ENV';

let sdk = null;

/**
 * Initialize OpenTelemetry SDK for distributed tracing
 */
export async function initTelemetry() {
    if (!config.telemetry.enabled) {
        console.log('OpenTelemetry is disabled');
        return null;
    }

    try {
        // Dynamic imports to avoid loading if telemetry is disabled
        const { NodeSDK } = await import('@opentelemetry/sdk-node');
        const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
        const { Resource } = await import('@opentelemetry/resources');
        const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');

        // Choose exporter based on protocol
        let TraceExporter;
        if (config.telemetry.protocol === 'grpc') {
            const module = await import('@opentelemetry/exporter-trace-otlp-grpc');
            TraceExporter = module.OTLPTraceExporter;
        } else {
            const module = await import('@opentelemetry/exporter-trace-otlp-http');
            TraceExporter = module.OTLPTraceExporter;
        }

        const exporterConfig = {
            url: config.telemetry.endpoint,
            headers: {}
        };

        // Add Dynatrace API token if provided
        if (config.telemetry.dynatraceToken) {
            exporterConfig.headers['Authorization'] = `Api-Token ${config.telemetry.dynatraceToken}`;
        }

        // Merge custom headers from config
        if (config.telemetry.customConfig.headers) {
            Object.assign(exporterConfig.headers, config.telemetry.customConfig.headers);
        }

        sdk = new NodeSDK({
            resource: new Resource({
                [SemanticResourceAttributes.SERVICE_NAME]: config.telemetry.serviceName,
                [SemanticResourceAttributes.SERVICE_VERSION]: config.telemetry.serviceVersion,
                ...config.telemetry.customConfig.resourceAttributes
            }),
            traceExporter: new TraceExporter(exporterConfig),
            instrumentations: [
                getNodeAutoInstrumentations({
                    // Disable noisy instrumentations
                    '@opentelemetry/instrumentation-fs': {
                        enabled: false
                    },
                    '@opentelemetry/instrumentation-http': {
                        enabled: true,
                        ignoreIncomingPaths: ['/health', '/readiness'],
                        ignoreOutgoingUrls: [/\/health$/, /\/readiness$/]
                    },
                    '@opentelemetry/instrumentation-dns': {
                        enabled: false
                    },
                    // Enable all others by default
                    ...config.telemetry.customConfig.instrumentations
                })
            ],
            // Sampling configuration
            ...(config.telemetry.sampleRate < 1.0 && {
                sampler: {
                    shouldSample: () => {
                        return Math.random() < config.telemetry.sampleRate
                            ? { decision: 1 } // RECORD_AND_SAMPLED
                            : { decision: 0 }; // NOT_RECORD
                    }
                }
            })
        });

        await sdk.start();
        console.log('OpenTelemetry SDK initialized successfully');
        console.log(`  Service: ${config.telemetry.serviceName}`);
        console.log(`  Endpoint: ${config.telemetry.endpoint || 'default'}`);
        console.log(`  Protocol: ${config.telemetry.protocol}`);
        console.log(`  Sample Rate: ${(config.telemetry.sampleRate * 100).toFixed(1)}%`);

        return sdk;
    } catch (error) {
        console.error('Failed to initialize OpenTelemetry:', error.message);
        return null;
    }
}

/**
 * Shutdown telemetry SDK and flush remaining spans
 */
export async function shutdownTelemetry() {
    if (sdk) {
        console.log('Shutting down OpenTelemetry SDK...');
        try {
            await sdk.shutdown();
            console.log('OpenTelemetry SDK shutdown complete');
        } catch (error) {
            console.error('Error shutting down OpenTelemetry:', error.message);
        }
    }
}

/**
 * Get tracer for custom instrumentation
 */
export function getTracer(name = 'sveltekit-adapter') {
    if (!config.telemetry.enabled) {
        return null;
    }

    try {
        const { trace } = require('@opentelemetry/api');
        return trace.getTracer(name);
    } catch {
        return null;
    }
}
