import { trace } from "@opentelemetry/api";
import { pino, type Logger, type LoggerOptions } from "pino";
import pretty from "pino-pretty";
import { config } from "../config.js";

/**
 * Redact anything credential-shaped from every log line — headers, tokens,
 * password hashes.
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

const options: LoggerOptions = { level: config.LOG_LEVEL, redact, mixin: otelMixin };

// pino-pretty as a *sync stream* (not a transport worker) — reliable under tsx/Windows.
const destination = config.isDev
  ? pretty({ translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname", colorize: true })
  : undefined;

/** The root logger — pass this instance to Fastify and use it directly elsewhere. */
export const logger: Logger = config.isTest
  ? pino({ level: "silent" })
  : destination
    ? pino(options, destination)
    : pino(options);
