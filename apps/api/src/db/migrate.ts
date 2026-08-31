import { existsSync } from "node:fs";
import { argv, cwd, env } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { config } from "../config.js";
import { createDb, createLibsql, enableForeignKeys } from "./client.js";

/** Works from source (tsx, cwd=apps/api) and from the bundled container (cwd=/app). */
function resolveMigrations(): string {
  const candidates = [
    env.MIGRATIONS_DIR,
    fileURLToPath(new URL("../../drizzle", import.meta.url)),
    resolve(cwd(), "drizzle"),
    resolve(cwd(), "apps/api/drizzle"),
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p)) ?? candidates[1]!;
}
const migrationsFolder = resolveMigrations();

/** Run all pending migrations. Called on server boot and by `pnpm db:migrate`. */
export async function runMigrations(url = config.DATABASE_URL): Promise<void> {
  const client = createLibsql(url);
  await enableForeignKeys(client);
  const db = createDb(client);
  await migrate(db, { migrationsFolder });
  client.close();
}

// Direct invocation: `tsx src/db/migrate.ts`
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  await runMigrations();
  console.log(`Migrations applied to ${config.DATABASE_URL}`);
}
