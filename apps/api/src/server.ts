import "./instrumentation.js"; // must be first — patches http/fastify for tracing
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { client, enableForeignKeys } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { logger } from "./lib/logger.js";

async function main() {
  await runMigrations();
  await enableForeignKeys(client);

  const app = await buildApp();
  await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
  logger.info(
    { port: config.API_PORT, version: config.version, otel: config.OTEL_MODE },
    "STOMP API listening",
  );
}

main().catch((err) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
