import "./instrumentation.js"; // must be first — patches http/fastify for tracing
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { db } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { startSyncScheduler, stopSyncScheduler } from "./jobs/syncScheduler.js";
import { logger } from "./lib/logger.js";

async function main() {
  await runMigrations();

  const app = await buildApp();
  await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
  logger.info(
    { port: config.API_PORT, version: config.version, otel: config.OTEL_MODE },
    "STOMP API listening",
  );

  if (config.integrationsConfigured) startSyncScheduler(db, config.SYNC_INTERVAL_MINUTES);
  const shutdown = async () => {
    stopSyncScheduler();
    await app.close();
    process.exit(0);
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

main().catch((err) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
