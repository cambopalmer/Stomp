import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type Client, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { config } from "../config.js";
import * as schema from "./schema.js";

/**
 * libSQL (SQLite-compatible). Local dev uses a `file:` URL; swapping to Turso
 * later is a connection-string change (ADR-0002).
 */
export function createLibsql(url: string): Client {
  if (url.startsWith("file:")) {
    const path = url.replace(/^file:/, "");
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  }
  return createClient({ url });
}

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(client: Client): Db {
  return drizzle(client, { schema });
}

/**
 * Per-connection SQLite settings. Idempotent — safe to call more than once.
 *  - foreign_keys: SQLite ships with FK enforcement OFF; the schema relies on it
 *  - journal_mode=WAL: readers don't block the writer (file DBs only; :memory: ignores it)
 *  - busy_timeout: wait up to 5s for a lock instead of failing with SQLITE_BUSY
 */
export async function applyPragmas(client: Client): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA busy_timeout = 5000");
}

/** Shared singleton for the running server. */
export const client = createLibsql(config.DATABASE_URL);
export const db: Db = createDb(client);
export { schema };
