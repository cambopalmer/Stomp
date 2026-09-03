import { trace } from "@opentelemetry/api";
import { pino, type LoggerOptions } from "pino";
import { config } from "../config.js";

/**
 * Redact anything credential-shaped from every log line — headers, tokens,
 * password hashes. Applies to Fastify's request logger and the standalone
 * `logger` below.
 */
const redact: LoggerOptions["redact"] = {
  paths: [
    "req.headers.authorization",
    "req.headers.cookie",
    'res.headers["set-cookie"]',
    "*.password",
    "*.passwordHash",
    "*.password_hash",
    "*.token",
    "*.accessToken",
    "*.refreshToken",
    "*.access_token",
    "*.refresh_token",
    "*.secret",
  ],
  censor: "[redacted]",
};

/** Attach the active trace/span id to every line so logs join up with traces. */
function otelMixin() {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const { traceId, spanId } = span.spanContext();
  return { trace_id: traceId, span_id: spanId };
}

export const loggerOptions: LoggerOptions = {
  level: config.LOG_LEVEL,
  redact,
  mixin: otelMixin,
  ...(config.isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {}),
};

/** Standalone logger for non-request contexts (startup, jobs, auth events). */
export const logger = pino(config.isTest ? { level: "silent" } : loggerOptions);
