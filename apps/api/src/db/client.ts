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

export async function enableForeignKeys(client: Client): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
}

/** Shared singleton for the running server. */
export const client = createLibsql(config.DATABASE_URL);
export const db: Db = createDb(client);
export { schema };
