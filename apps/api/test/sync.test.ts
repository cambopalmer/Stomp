import { and, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { events, integrationAccounts, syncLog, users } from "../src/db/schema.js";
import { seed } from "../src/db/seed.js";
import { seal } from "../src/lib/crypto.js";
import { newId } from "../src/lib/ids.js";

// AUTH_TEST_BYPASS: requests act as the seeded owner.
let app: FastifyInstance;
let ownerId: string;
let accountId: string;

const DAY = 86_400_000;
const soon = (days: number, hour = 9) => {
  const d = new Date(Date.now() + days * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
const dateOnly = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

/** Mutable fake of Google Calendar — tests edit it between syncs. */
let calendars: { id: string; summary: string; primary?: boolean }[];
let feed: Record<string, Record<string, unknown>[]>;
let failCalendar: string | null;

function stubGoogle() {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/calendar/v3/users/me/calendarList") return json(200, { items: calendars });
      const m = url.pathname.match(/^\/calendar\/v3\/calendars\/([^/]+)\/events$/);
      if (m) {
        const cal = decodeURIComponent(m[1]!);
        if (cal === failCalendar) return json(500, { error: { message: "Backend Error" } });
        expect(url.searchParams.get("singleEvents")).toBe("true");
        return json(200, { timeZone: "America/Denver", items: feed[cal] ?? [] });
      }
      return json(404, { error: { message: `unexpected ${url}` } });
    }),
  );
}

const api = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, payload });
const mirrors = () =>
  db.select().from(events).where(and(eq(events.createdBy, ownerId), eq(events.externalProvider, "google")));
const titles = async () => (await mirrors()).map((e) => e.title).sort();

beforeAll(async () => {
  await seed();
  app = await buildApp();
  ownerId = (await db.select().from(users).where(eq(users.email, "owner@stomp.local")))[0]!.id;
});
afterAll(() => app.close());
afterEach(() => vi.unstubAllGlobals());

beforeEach(async () => {
  // fresh connected calendar account with a valid (sealed) token each test
  await db.delete(integrationAccounts).where(eq(integrationAccounts.userId, ownerId));
  await db.delete(events).where(and(eq(events.createdBy, ownerId), eq(events.externalProvider, "google")));
  accountId = newId();
  await db.insert(integrationAccounts).values({
    id: accountId,
    userId: ownerId,
    provider: "google_calendar",
    email: "cam@gmail.com",
    accessToken: seal("at-live"),
    refreshToken: seal("rt-live"),
    tokenExpiresAt: Date.now() + 3600_000,
    scopes: "https://www.googleapis.com/auth/calendar.readonly",
    status: "connected",
  });
  calendars = [
    { id: "cam@gmail.com", summary: "Cam", primary: true },
    { id: "family@group.calendar.google.com", summary: "Family" },
    { id: "en.usa#holiday@group.v.calendar.google.com", summary: "Holidays" },
  ];
  feed = {
    "cam@gmail.com": [
      { id: "standup_1", etag: '"1"', summary: "Standup", start: { dateTime: soon(1, 15) }, end: { dateTime: soon(1, 16) } },
      { id: "trip", etag: '"1"', summary: "Trip", start: { date: dateOnly(3) }, end: { date: dateOnly(5) } },
      { id: "nope", etag: '"1"', summary: "Declined thing", start: { dateTime: soon(2) }, end: { dateTime: soon(2, 10) }, attendees: [{ self: true, responseStatus: "declined" }] },
      { id: "gone", etag: '"1"', status: "cancelled" },
    ],
    "family@group.calendar.google.com": [
      { id: "dinner", etag: '"1"', summary: "Family dinner", start: { dateTime: soon(2, 1) }, end: { dateTime: soon(2, 3) } },
    ],
  };
  failCalendar = null;
  stubGoogle();
});

describe("calendar sync", () => {
  it("first sync lists calendars (primary on) and mirrors only the primary", async () => {
    const r = await api("POST", `/api/integrations/${accountId}/sync`);
    expect(r.statusCode).toBe(200);
    expect(r.json().calendars.map((c: { summary: string; selected: boolean }) => [c.summary, c.selected])).toEqual([
      ["Cam", true],
      ["Family", false],
      ["Holidays", false],
    ]);
    expect(r.json().lastSyncAt).toBeTypeOf("number");
    // declined + cancelled are skipped
    expect(await titles()).toEqual(["Standup", "Trip"]);
  });

  it("stores all-day events as floating dates (UTC midnight, exclusive end)", async () => {
    await api("POST", `/api/integrations/${accountId}/sync`);
    const trip = (await mirrors()).find((e) => e.title === "Trip")!;
    expect(trip.allDay).toBe(true);
    expect(new Date(trip.startsAt).toISOString()).toBe(`${dateOnly(3)}T00:00:00.000Z`);
    expect(new Date(trip.endsAt).toISOString()).toBe(`${dateOnly(5)}T00:00:00.000Z`);
    expect(trip.externalId).toBe("cam@gmail.com|trip");
  });

  it("picking calendars imports new ones and drops deselected ones", async () => {
    await api("POST", `/api/integrations/${accountId}/sync`);
    const r = await api("PUT", `/api/integrations/${accountId}/calendars`, {
      calendarIds: ["family@group.calendar.google.com"],
    });
    expect(r.statusCode).toBe(200);
    expect(await titles()).toEqual(["Family dinner"]);

    const bad = await api("PUT", `/api/integrations/${accountId}/calendars`, { calendarIds: ["nope@x"] });
    expect(bad.statusCode).toBe(400);
  });

  it("follows upstream edits (by etag) and deletions", async () => {
    await api("POST", `/api/integrations/${accountId}/sync`);
    feed["cam@gmail.com"]![0] = { ...feed["cam@gmail.com"]![0], etag: '"2"', summary: "Standup (moved)" };
    feed["cam@gmail.com"]!.splice(1, 1); // Trip deleted in Google
    await api("POST", `/api/integrations/${accountId}/sync`);
    expect(await titles()).toEqual(["Standup (moved)"]);

    const log = await db.select().from(syncLog).where(eq(syncLog.integrationAccountId, accountId));
    expect(log.map((l) => l.summary)).toContain("1 calendar: +0 ~1 −1");
  });

  it("a Google error leaves local events untouched and is recorded", async () => {
    await api("POST", `/api/integrations/${accountId}/sync`);
    failCalendar = "cam@gmail.com";
    feed["cam@gmail.com"] = []; // would wipe everything if we applied a partial result
    const r = await api("POST", `/api/integrations/${accountId}/sync`);
    expect(r.json().lastError).toMatch(/Backend Error/);
    expect(await titles()).toEqual(["Standup", "Trip"]);
    const failed = (await db.select().from(syncLog).where(eq(syncLog.integrationAccountId, accountId))).find((l) => l.error);
    expect(failed?.summary).toBe("failed");
  });

  it("mirrored events are read-only and show up in the events API", async () => {
    await api("POST", `/api/integrations/${accountId}/sync`);
    const standup = (await mirrors()).find((e) => e.title === "Standup")!;
    const listed = (await api("GET", `/api/events?from=${Date.now()}&to=${Date.now() + 7 * DAY}`)).json();
    expect(listed.map((e: { id: string }) => e.id)).toContain(standup.id);

    const edit = await api("PATCH", `/api/events/${standup.id}`, { title: "hacked" });
    expect(edit.statusCode).toBe(403);
    expect(edit.json().message).toMatch(/Google Calendar/);
    expect((await api("DELETE", `/api/events/${standup.id}`)).statusCode).toBe(403);
  });

  it("disconnecting (default) removes this connection's mirrors and says how many", async () => {
    await api("POST", `/api/integrations/${accountId}/sync`);
    const list = (await api("GET", "/api/integrations")).json();
    expect(list.accounts[0].mirroredEvents).toBe(2);
    const del = await api("DELETE", `/api/integrations/${accountId}`);
    expect(del.json()).toEqual({ kept: 0, removed: 2 });
    expect(await mirrors()).toHaveLength(0);
  });

  it("disconnect with keepEvents turns mirrors into ordinary, editable STOMP events", async () => {
    await api("POST", `/api/integrations/${accountId}/sync`);
    const before = (await mirrors()).map((e) => e.id).sort();
    const del = await api("DELETE", `/api/integrations/${accountId}?keepEvents=true`);
    expect(del.json()).toEqual({ kept: 2, removed: 0 });

    const kept = await db.select().from(events).where(inArray(events.id, before));
    expect(kept).toHaveLength(2);
    for (const e of kept) {
      expect(e).toMatchObject({ externalProvider: null, externalId: null, integrationAccountId: null, createdBy: ownerId });
    }
    const edit = await api("PATCH", `/api/events/${before[0]}`, { title: "mine now" });
    expect(edit.statusCode).toBe(200);
  });

  it("two calendar connections never touch each other's events (duplicates are fine)", async () => {
    const second = newId();
    await db.insert(integrationAccounts).values({
      id: second,
      userId: ownerId,
      provider: "google_calendar",
      email: "work@gmail.com",
      accessToken: seal("at-2"),
      refreshToken: seal("rt-2"),
      tokenExpiresAt: Date.now() + 3600_000,
      status: "connected",
    });
    await api("POST", `/api/integrations/${accountId}/sync`);
    await api("POST", `/api/integrations/${second}/sync`);
    const own = async (id: string) => db.select().from(events).where(eq(events.integrationAccountId, id));
    expect(await own(accountId)).toHaveLength(2);
    expect(await own(second)).toHaveLength(2); // same Google events, separate copies

    // re-syncing one doesn't treat the other's copies as stale
    await api("POST", `/api/integrations/${accountId}/sync`);
    expect(await own(second)).toHaveLength(2);

    // disconnecting one leaves the other alone
    await api("DELETE", `/api/integrations/${accountId}`);
    expect(await own(second)).toHaveLength(2);
  });

  it("someone else can't sync or reconfigure your account", async () => {
    const sam = (await db.select().from(users).where(eq(users.email, "sam@stomp.local")))[0]!;
    const { syncNow, selectCalendars } = await import("../src/services/sync.js");
    await expect(syncNow(db, { userId: sam.id }, accountId)).rejects.toThrow(/not found/);
    await expect(selectCalendars(db, { userId: sam.id }, accountId, [])).rejects.toThrow(/not found/);
  });
});

describe("all-day events on Home (floating dates)", () => {
  it("'today' means the user's local date for all-day events, not a UTC-ms overlap", async () => {
    // the seeded owner lives in America/Denver
    const ymd = (offsetDays: number) => {
      const s = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date());
      const [y, m, d] = s.split("-").map(Number) as [number, number, number];
      return Date.UTC(y, m - 1, d + offsetDays);
    };
    const mk = (title: string, day: number) => ({
      id: newId(),
      title,
      startsAt: ymd(day),
      endsAt: ymd(day + 1),
      allDay: true,
      createdBy: ownerId,
    });
    await db.insert(events).values([mk("AD yesterday", -1), mk("AD today", 0), mk("AD tomorrow", 1)]);

    const hot = (await api("GET", "/api/home/hot")).json();
    const names = hot.events.map((e: { title: string }) => e.title);
    expect(names).toContain("AD today");
    expect(names).not.toContain("AD yesterday");
    expect(names).not.toContain("AD tomorrow");
  });
});

describe("planner blocks anchored to a Google event (ADR-0006)", () => {
  it("follow upstream moves and are kept + flagged when the event disappears", async () => {
    const { eventLocalStart } = await import("../src/services/anchors.js");
    const { timeBlocks } = await import("../src/db/schema.js");
    await api("POST", `/api/integrations/${accountId}/sync`);
    const standup = (await mirrors()).find((e) => e.title === "Standup")!;
    const at = await eventLocalStart(db, ownerId, standup);
    const blk = (
      await api("POST", "/api/time-blocks", {
        date: at.date,
        startMin: at.minute - 15,
        endMin: at.minute,
        title: "Prep notes",
        anchorEventId: standup.id,
      })
    ).json();
    expect(blk.anchorOffsetMin).toBe(-15);

    // moved an hour later in Google
    const e0 = feed["cam@gmail.com"]![0]!;
    feed["cam@gmail.com"]![0] = { ...e0, etag: '"9"', start: { dateTime: soon(1, 16) }, end: { dateTime: soon(1, 17) } };
    await api("POST", `/api/integrations/${accountId}/sync`);
    const moved = (await db.select().from(timeBlocks).where(eq(timeBlocks.id, blk.id)))[0]!;
    expect(moved.startMin).toBe(blk.startMin + 60);

    // deleted in Google → the plan keeps the block, flagged
    feed["cam@gmail.com"]!.splice(0, 1);
    await api("POST", `/api/integrations/${accountId}/sync`);
    const kept = (await db.select().from(timeBlocks).where(eq(timeBlocks.id, blk.id)))[0]!;
    expect(kept).toMatchObject({ anchorEventId: null, anchorLost: true });
  });
});
