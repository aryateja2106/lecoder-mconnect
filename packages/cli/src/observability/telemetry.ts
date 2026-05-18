import { trace, context, Span } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

export interface MConnectMetrics {
  startTime: number;
  commandsExecuted: number;
  commandsBlocked: number;
  securityEvents: number;
  containersCreated: number;
  containerErrors: number;
  authFailures: number;
  inputsRejected: number;
  agentsSpawned: number;
  exclusiveGrants: number;
  rateLimitEvents: number;
}

const tracer = trace.getTracer('mconnect-cli');

export function getTracer() {
  return tracer;
}

export function initTelemetryFromEnv() {
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [],
  });

  try {
    sdk.start();
    return true;
  } catch (err) {
    console.error('Error initializing OpenTelemetry', err);
    return false;
  }
}
