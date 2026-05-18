import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { trace } from '@opentelemetry/api';

export function initTelemetry(): NodeSDK {
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    // add instrumentations here if needed
  });

  sdk.start();
  return sdk;
}

export const tracer = trace.getTracer('mconnect-server');
