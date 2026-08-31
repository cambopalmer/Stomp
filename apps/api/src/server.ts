import { config } from "./config.js";
import { enableForeignKeys, client } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { buildApp } from "./app.js";

async function main() {
  await runMigrations();
  await enableForeignKeys(client);

  const app = await buildApp();
  await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
  app.log.info(`STOMP API on :${config.API_PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
