import { and, eq, isNull, lt, notInArray, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { integrationAccounts, syncLog } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { logger } from "../lib/logger.js";
import { syncAccount } from "../services/sync.js";

/**
 * Background sync (ADR-0005: every 10 min). In-process and single-instance by
 * design — STOMP runs as one container. Started from server.ts only, never in
 * tests. Runs accounts one at a time; skips a tick if the last one is still going.
 */

const LOG_KEEP_PER_ACCOUNT = 100;
const LOG_MAX_AGE_MS = 30 * 86_400_000;

let timer: NodeJS.Timeout | null = null;
let running = false;

/** One pass over every connected account. Exported for tests and an admin "sync all" later. */
export async function runSyncPass(db: Db): Promise<{ accounts: number; failed: number }> {
  if (running) return { accounts: 0, failed: 0 };
  running = true;
  let failed = 0;
  try {
    const rows = await db.select().from(integrationAccounts).where(eq(integrationAccounts.status, "connected"));
    for (const row of rows) {
      const r = await syncAccount(db, row); // never throws for provider trouble
      if (r === null) failed++;
    }
    await pruneSyncLog(db);
    if (rows.length) logger.info({ accounts: rows.length, failed }, "scheduled sync pass");
    return { accounts: rows.length, failed };
  } catch (err) {
    logger.error({ err }, "scheduled sync pass crashed");
    return { accounts: 0, failed };
  } finally {
    running = false;
  }
}

/** Keep the newest LOG_KEEP_PER_ACCOUNT rows per account, and nothing older than 30 days. */
export async function pruneSyncLog(db: Db): Promise<void> {
  await db.delete(syncLog).where(lt(syncLog.startedAt, clock.now() - LOG_MAX_AGE_MS));
  const accounts = await db.selectDistinct({ id: syncLog.integrationAccountId }).from(syncLog);
  for (const { id } of accounts) {
    const keep = db
      .select({ id: syncLog.id })
      .from(syncLog)
      .where(eq(syncLog.integrationAccountId, id))
      .orderBy(sql`${syncLog.startedAt} desc`)
      .limit(LOG_KEEP_PER_ACCOUNT);
    await db.delete(syncLog).where(and(eq(syncLog.integrationAccountId, id), notInArray(syncLog.id, keep)));
  }
}

/** A restart mid-run leaves "running" rows behind — close them out honestly. */
export async function closeInterruptedRuns(db: Db): Promise<void> {
  await db
    .update(syncLog)
    .set({ summary: "interrupted", error: "Server stopped during this sync", finishedAt: clock.now() })
    .where(and(eq(syncLog.summary, "running"), isNull(syncLog.finishedAt)));
}

export function startSyncScheduler(db: Db, intervalMinutes: number): void {
  if (intervalMinutes <= 0 || timer) return;
  void closeInterruptedRuns(db);
  const ms = intervalMinutes * 60_000;
  // first pass shortly after boot, not immediately — let the server settle
  const first = setTimeout(() => void runSyncPass(db), Math.min(ms, 30_000));
  first.unref();
  timer = setInterval(() => void runSyncPass(db), ms);
  timer.unref(); // never keeps the process alive on its own
  logger.info({ everyMinutes: intervalMinutes }, "sync scheduler started");
}

export function stopSyncScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
