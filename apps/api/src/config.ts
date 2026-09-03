import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

// Load .env from the repo root and from apps/api (the latter wins).
loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
loadEnv();

const schema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default("file:./.data/stomp.db"),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  SEED_USER_EMAIL: z.string().email().default("owner@stomp.local"),
  PUBLIC_BASE_URL: z.string().default("http://localhost:8080"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // ─── observability ───
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** "off" (default) | "console" | "otlp" */
  OTEL_MODE: z.enum(["off", "console", "otlp"]).default("off"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://localhost:4318"),
  SERVICE_NAME: z.string().default("stomp-api"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  sqlitePath: parsed.data.DATABASE_URL.replace(/^file:/, ""),
  isTest: parsed.data.NODE_ENV === "test",
  isDev: parsed.data.NODE_ENV === "development",
  version: process.env.BUILD_VERSION ?? process.env.npm_package_version ?? "0.0.0",
};
