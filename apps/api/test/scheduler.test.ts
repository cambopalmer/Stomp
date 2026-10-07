import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { integrationAccounts, syncLog, users } from "../src/db/schema.js";
import { seed } from "../src/db/seed.js";
import { closeInterruptedRuns, pruneSyncLog, runSyncPass } from "../src/jobs/syncScheduler.js";
import { seal } from "../src/lib/crypto.js";
import { newId } from "../src/lib/ids.js";

let app: FastifyInstance;
let ownerId: string;
let samId: string;

/** Minimal Google: one empty calendar, a STOMP label with no mail. Slow on demand. */
let delayMs = 0;
function stubGoogle() {
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      const p = new URL(String(input)).pathname;
      if (p.endsWith("/calendarList")) return json({ items: [{ id: "me@x", summary: "Me", primary: true }] });
      if (p.includes("/calendars/")) return json({ items: [] });
      if (p.endsWith("/labels")) return json({ labels: [{ id: "L1", name: "STOMP" }] });
      if (p.endsWith("/messages")) return json({ messages: [] });
      return new Response("{}", { status: 404 });
    }),
  );
}

async function account(userId: string, provider: "gmail" | "google_calendar", status: "connected" | "needs_reauth" = "connected") {
  const id = newId();
  await db.insert(integrationAccounts).values({
    id,
    userId,
    provider,
    email: `${provider}-${id.slice(0, 6)}@gmail.com`,
    accessToken: seal("at"),
    refreshToken: seal("rt"),
    tokenExpiresAt: Date.now() + 3600_000,
    status,
  });
  return id;
}

beforeAll(async () => {
  await seed();
  app = await buildApp();
  ownerId = (await db.select().from(users).where(eq(users.email, "owner@stomp.local")))[0]!.id;
  samId = (await db.select().from(users).where(eq(users.email, "sam@stomp.local")))[0]!.id;
});
afterAll(() => app.close());
beforeEach(async () => {
  await db.delete(integrationAccounts);
  delayMs = 0;
  stubGoogle();
});
afterEach(() => vi.unstubAllGlobals());

describe("sync scheduler", () => {
  it("one pass syncs every connected account (all users) and skips ones needing re-auth", async () => {
    const cal = await account(ownerId, "google_calendar");
    const mail = await account(samId, "gmail");
    const dead = await account(ownerId, "gmail", "needs_reauth");

    expect(await runSyncPass(db)).toEqual({ accounts: 2, failed: 0 });
    const synced = await db.select().from(integrationAccounts);
    expect(synced.find((a) => a.id === cal)!.lastSyncAt).toBeTypeOf("number");
    expect(synced.find((a) => a.id === mail)!.lastSyncAt).toBeTypeOf("number");
    expect(synced.find((a) => a.id === dead)!.lastSyncAt).toBeNull();
  });

  it("never overlaps itself — a tick during a slow pass is skipped", async () => {
    await account(ownerId, "google_calendar");
    delayMs = 50;
    const [a, b] = await Promise.all([runSyncPass(db), runSyncPass(db)]);
    expect([a.accounts, b.accounts].sort()).toEqual([0, 1]);
  });

  it("a failing account doesn't stop the others", async () => {
    await account(ownerId, "google_calendar");
    await account(samId, "gmail");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const p = new URL(String(input)).pathname;
        if (p.endsWith("/labels")) return new Response(JSON.stringify({ labels: [{ id: "L1", name: "STOMP" }] }), { status: 200 });
        if (p.endsWith("/messages")) return new Response(JSON.stringify({ messages: [] }), { status: 200 });
        return new Response(JSON.stringify({ error: { message: "calendar down" } }), { status: 503 });
      }),
    );
    expect(await runSyncPass(db)).toEqual({ accounts: 2, failed: 1 });
  });

  it("prunes the log to 100 rows per account and nothing older than 30 days", async () => {
    const id = await account(ownerId, "gmail");
    const now = Date.now();
    await db.insert(syncLog).values([
      ...Array.from({ length: 105 }, (_, i) => ({
        id: newId(),
        integrationAccountId: id,
        direction: "pull" as const,
        entityType: "email" as const,
        summary: `run ${i}`,
        startedAt: now - i * 60_000,
        finishedAt: now - i * 60_000,
      })),
    ]);
    await db.update(syncLog).set({ startedAt: now - 40 * 86_400_000 }).where(eq(syncLog.summary, "run 3"));
    await pruneSyncLog(db);
    const left = await db.select().from(syncLog).where(eq(syncLog.integrationAccountId, id));
    expect(left).toHaveLength(100);
    expect(left.map((l) => l.summary)).not.toContain("run 3"); // too old
    expect(left.map((l) => l.summary)).not.toContain("run 104"); // beyond the newest 100
    expect(left.map((l) => l.summary)).toContain("run 0");
  });

  it("closes out runs a restart interrupted", async () => {
    const id = await account(ownerId, "gmail");
    const logId = newId();
    await db.insert(syncLog).values({ id: logId, integrationAccountId: id, direction: "pull", entityType: "email", summary: "running" });
    await closeInterruptedRuns(db);
    const [row] = await db.select().from(syncLog).where(eq(syncLog.id, logId));
    expect(row).toMatchObject({ summary: "interrupted" });
    expect(row!.finishedAt).toBeTypeOf("number");
  });
});

describe("sync history API", () => {
  it("lists your account's runs newest first; others get 404", async () => {
    const id = await account(ownerId, "gmail");
    await runSyncPass(db);
    await runSyncPass(db);
    const r = await app.inject({ method: "GET", url: `/api/integrations/${id}/log?limit=5` });
    expect(r.statusCode).toBe(200);
    const runs = r.json() as { startedAt: number; summary: string }[];
    expect(runs).toHaveLength(2);
    expect(runs[0]!.startedAt).toBeGreaterThanOrEqual(runs[1]!.startedAt);
    expect(runs[0]!.summary).toMatch(/label STOMP/);

    const samAcct = await account(samId, "gmail");
    expect((await app.inject({ method: "GET", url: `/api/integrations/${samAcct}/log` })).statusCode).toBe(404);
  });
});
