/**
 * OpenTelemetry bootstrap. Imported first thing in server.ts so the
 * auto-instrumentations can patch `http` / `fastify` before they're required.
 *
 * OTEL_MODE:
 *   off      (default) — SDK not started, zero overhead
 *   console  — spans printed to stdout (local dev)
 *   otlp     — spans exported to OTEL_EXPORTER_OTLP_ENDPOINT (Tempo / SigNoz / Jaeger / …)
 */
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK, resources, tracing } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { config } from "./config.js";

if (config.OTEL_MODE !== "off" && !config.isTest) {
  const exporter =
    config.OTEL_MODE === "console"
      ? new tracing.ConsoleSpanExporter()
      : new OTLPTraceExporter({ url: `${config.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` });

  const sdk = new NodeSDK({
    resource: new resources.Resource({
      [ATTR_SERVICE_NAME]: config.SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: config.version,
    }),
    // console: flush each span immediately; otlp: batch
    spanProcessors: [
      config.OTEL_MODE === "console"
        ? new tracing.SimpleSpanProcessor(exporter)
        : new tracing.BatchSpanProcessor(exporter),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-net": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  });
  sdk.start();
  process.on("SIGTERM", () => void sdk.shutdown());
}
