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

  // ─── auth (Phase 3) ───
  SESSION_SECRET: z.string().min(16).default("dev-session-secret-not-for-production-use-only"),
  SEED_USER_PASSWORD: z.string().default("stomp-dev-password"),
  ALLOW_SIGNUP: z.coerce.boolean().default(true),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** tests only: fall back to SEED_USER_EMAIL when no session cookie is present */
  AUTH_TEST_BYPASS: z.coerce.boolean().default(false),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

if (env.NODE_ENV === "production" && env.SESSION_SECRET.startsWith("dev-session-secret")) {
  console.error("SESSION_SECRET must be set to a strong value in production");
  process.exit(1);
}

export const config = {
  ...env,
  sqlitePath: env.DATABASE_URL.replace(/^file:/, ""),
  isTest: env.NODE_ENV === "test",
  isDev: env.NODE_ENV === "development",
  isProd: env.NODE_ENV === "production",
  version: process.env.BUILD_VERSION ?? process.env.npm_package_version ?? "0.0.0",
  googleOAuthConfigured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
};
