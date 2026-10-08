import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { events, timeBlocks, users } from "../src/db/schema.js";
import { seed } from "../src/db/seed.js";
import { newId } from "../src/lib/ids.js";

// AUTH_TEST_BYPASS: the seeded owner, in America/Denver (UTC-7 in winter).
let app: FastifyInstance;
let samId: string;

const D = "2031-01-15";
const at = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00-07:00`);
const api = (method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, payload });
const row = async (id: string) => (await db.select().from(timeBlocks).where(eq(timeBlocks.id, id)))[0]!;

async function gymnastics() {
  const ev = (
    await api("POST", "/api/events", { title: "Gymnastics", startsAt: at(D, "18:00"), endsAt: at(D, "19:30") })
  ).json();
  // "Add before…" twice: Drive 30 right before, Dinner 30 before that
  const drive = (await api("POST", "/api/time-blocks", { date: D, startMin: 1050, endMin: 1080, title: "Drive", anchorEventId: ev.id })).json();
  const dinner = (await api("POST", "/api/time-blocks", { date: D, startMin: 1020, endMin: 1050, title: "Dinner", anchorEventId: ev.id })).json();
  return { ev, drive, dinner };
}

beforeAll(async () => {
  await seed();
  app = await buildApp();
  samId = (await db.select().from(users).where(eq(users.email, "sam@stomp.local")))[0]!.id;
});
afterAll(() => app.close());

describe("anchored blocks", () => {
  it("record their offset from the event's start", async () => {
    const { ev, drive, dinner } = await gymnastics();
    expect(drive).toMatchObject({ anchorEventId: ev.id, anchorOffsetMin: -30, anchorLost: false });
    expect(dinner.anchorOffsetMin).toBe(-60);
  });

  it("follow the event when it moves — later the same day, and to another day", async () => {
    const { ev, drive, dinner } = await gymnastics();
    await api("PATCH", `/api/events/${ev.id}`, { startsAt: at(D, "19:00"), endsAt: at(D, "20:30") });
    expect(await row(drive.id)).toMatchObject({ date: D, startMin: 1110, endMin: 1140 });
    expect(await row(dinner.id)).toMatchObject({ date: D, startMin: 1080, endMin: 1110 });

    await api("PATCH", `/api/events/${ev.id}`, { startsAt: at("2031-01-16", "08:00"), endsAt: at("2031-01-16", "09:30") });
    expect(await row(drive.id)).toMatchObject({ date: "2031-01-16", startMin: 450, endMin: 480 });
    expect(await row(dinner.id)).toMatchObject({ date: "2031-01-16", startMin: 420, endMin: 450 });
  });

  it("an event just after midnight pulls its blocks back onto the evening before", async () => {
    const { ev, drive, dinner } = await gymnastics();
    await api("PATCH", `/api/events/${ev.id}`, { startsAt: at("2031-01-16", "00:15"), endsAt: at("2031-01-16", "01:00") });
    // 23:45–00:15 would cross midnight, which blocks never do (ADR-0006): it's pulled back to end at 24:00
    expect(await row(drive.id)).toMatchObject({ date: D, startMin: 1410, endMin: 1440 });
    expect(await row(dinner.id)).toMatchObject({ date: D, startMin: 1395, endMin: 1425 });
  });

  it("cancelling the event keeps the blocks, un-anchored and flagged", async () => {
    const { ev, drive } = await gymnastics();
    await api("PATCH", `/api/events/${ev.id}`, { status: "cancelled" });
    expect(await row(drive.id)).toMatchObject({ anchorEventId: null, anchorOffsetMin: null, anchorLost: true, startMin: 1050 });
  });

  it("deleting the event does the same; the flag can be dismissed", async () => {
    const { ev, dinner } = await gymnastics();
    await api("DELETE", `/api/events/${ev.id}`);
    expect(await row(dinner.id)).toMatchObject({ anchorEventId: null, anchorLost: true });
    const r = await api("PATCH", `/api/time-blocks/${dinner.id}`, { anchorLost: false });
    expect(r.json().anchorLost).toBe(false);
  });

  it("moving an attached block by hand re-anchors it; moving it to another day detaches it", async () => {
    const { ev, drive, dinner } = await gymnastics();
    await api("PATCH", `/api/time-blocks/${drive.id}`, { startMin: 1035, endMin: 1065 }); // leave 15 min earlier
    expect((await row(drive.id)).anchorOffsetMin).toBe(-45);
    await api("PATCH", `/api/events/${ev.id}`, { startsAt: at(D, "18:30"), endsAt: at(D, "20:00") });
    expect(await row(drive.id)).toMatchObject({ startMin: 1065, endMin: 1095 });

    await api("PATCH", `/api/time-blocks/${dinner.id}`, { date: "2031-01-20" });
    expect(await row(dinner.id)).toMatchObject({ anchorEventId: null, anchorLost: false, date: "2031-01-20" });
  });

  it("only attaches to visible, timed events on the block's day", async () => {
    const allDay = (
      await api("POST", "/api/events", { title: "Holiday", startsAt: Date.UTC(2031, 0, 15), endsAt: Date.UTC(2031, 0, 16), allDay: true })
    ).json();
    const theirs = newId();
    await db.insert(events).values({ id: theirs, title: "Sam's", startsAt: at(D, "10:00"), endsAt: at(D, "11:00"), createdBy: samId });
    const { ev } = await gymnastics();
    const tryAnchor = (eventId: string, date = D) =>
      api("POST", "/api/time-blocks", { date, startMin: 600, endMin: 630, title: "x", anchorEventId: eventId });
    expect((await tryAnchor(allDay.id)).statusCode).toBe(400);
    expect((await tryAnchor(theirs)).statusCode).toBe(400);
    expect((await tryAnchor(ev.id, "2031-01-14")).statusCode).toBe(400);
  });
});
