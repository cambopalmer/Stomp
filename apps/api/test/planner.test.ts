import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { categories, dayNotes, events, timeBlocks, users } from "../src/db/schema.js";
import { seed } from "../src/db/seed.js";
import { clock } from "../src/lib/clock.js";
import { dateBounds, localNow } from "../src/lib/day.js";
import { newId } from "../src/lib/ids.js";
import * as planner from "../src/services/planner.js";

// AUTH_TEST_BYPASS: requests act as the seeded owner, who lives in America/Denver.
let app: FastifyInstance;
let ownerId: string;
let samId: string;

const DAY = "2031-01-15"; // a winter Wednesday — Denver is UTC-7
const at = (hhmm: string) => Date.parse(`${DAY}T${hhmm}:00-07:00`);

const api = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, payload });
const block = (payload: object) => api("POST", "/api/time-blocks", { date: DAY, ...payload });

beforeAll(async () => {
  await seed();
  app = await buildApp();
  ownerId = (await db.select().from(users).where(eq(users.email, "owner@stomp.local")))[0]!.id;
  samId = (await db.select().from(users).where(eq(users.email, "sam@stomp.local")))[0]!.id;
});
afterAll(() => app.close());
afterEach(() => clock.unfreeze());

describe("wall-clock helpers", () => {
  it("knows today + minute in a zone, and a date's UTC bounds (DST days are 23/25 h)", () => {
    expect(localNow(at("10:00"), "America/Denver")).toEqual({ date: DAY, minute: 600 });
    const spring = dateBounds("2031-03-09", "America/Denver"); // clocks go forward
    expect((spring.dayEnd - spring.dayStart) / 3_600_000).toBe(23);
    const fall = dateBounds("2031-11-02", "America/Denver"); // clocks go back
    expect((fall.dayEnd - fall.dayStart) / 3_600_000).toBe(25);
  });
});

describe("categories", () => {
  it("first use seeds the 8 defaults once, with icons", async () => {
    const first = (await api("GET", "/api/categories")).json();
    expect(first.map((c: { name: string }) => c.name)).toEqual([
      "Work", "Focus", "Admin & errands", "Chores", "Family", "Personal", "Health", "Travel",
    ]);
    expect(first[0]).toMatchObject({ color: "blue", icon: "briefcase", archived: false });
    expect((await api("GET", "/api/categories")).json()).toHaveLength(8);
  });

  it("custom categories: duplicate live names conflict; unknown colours are rejected", async () => {
    const r = await api("POST", "/api/categories", { name: "Gymnastics", color: "fuchsia", icon: "star" });
    expect(r.statusCode).toBe(201);
    expect((await api("POST", "/api/categories", { name: "Gymnastics", color: "blue", icon: "star" })).statusCode).toBe(409);
    expect((await api("POST", "/api/categories", { name: "X", color: "neon", icon: "star" })).statusCode).toBe(400);
  });

  it("deleting: unused is removed; used is archived (and can't take new blocks)", async () => {
    const unused = (await api("POST", "/api/categories", { name: "Temp", color: "slate", icon: "moon" })).json();
    expect((await api("DELETE", `/api/categories/${unused.id}`)).json()).toEqual({ archived: false });

    const used = (await api("POST", "/api/categories", { name: "Piano", color: "teal", icon: "music" })).json();
    expect((await block({ startMin: 60, endMin: 90, title: "practice", categoryId: used.id })).statusCode).toBe(201);
    expect((await api("DELETE", `/api/categories/${used.id}`)).json()).toEqual({ archived: true });
    const listed = (await api("GET", "/api/categories")).json().find((c: { id: string }) => c.id === used.id);
    expect(listed.archived).toBe(true);
    expect((await block({ startMin: 90, endMin: 120, title: "more", categoryId: used.id })).statusCode).toBe(400);
    // the name is free again for a live category
    expect((await api("POST", "/api/categories", { name: "Piano", color: "teal", icon: "music" })).statusCode).toBe(201);
  });

  it("someone else's category can't be used", async () => {
    const theirs = (await planner.listCategories(db, { userId: samId }))[0]!;
    expect((await block({ startMin: 0, endMin: 15, title: "x", categoryId: theirs.id })).statusCode).toBe(404);
  });
});

describe("blocks: the 15-minute wall-clock grid", () => {
  it.each([
    ["off-grid start", { startMin: 610, endMin: 630 }],
    ["end before start", { startMin: 600, endMin: 600 }],
    ["past midnight", { startMin: 1380, endMin: 1455 }],
    ["not a real date", { date: "2031-02-30", startMin: 0, endMin: 15 }],
  ])("rejects %s", async (_label, times) => {
    expect((await block({ title: "x", ...times })).statusCode).toBe(400);
  });

  it("allows a block that ends exactly at midnight", async () => {
    expect((await block({ title: "late", startMin: 1380, endMin: 1440 })).statusCode).toBe(201);
  });

  it("needs a title or a linked todo; a todo you can't see is refused", async () => {
    expect((await block({ startMin: 0, endMin: 15 })).statusCode).toBe(400);
    const samsTodo = (
      await app.inject({ method: "POST", url: "/api/todos", payload: { title: "mine" } })
    ).json(); // owner's — visible
    expect((await block({ startMin: 0, endMin: 15, todoId: samsTodo.id })).statusCode).toBe(201);

    const privateToSam = newId();
    const { todos } = await import("../src/db/schema.js");
    await db.insert(todos).values({ id: privateToSam, title: "sam only", createdBy: samId });
    expect((await block({ startMin: 0, endMin: 15, todoId: privateToSam })).statusCode).toBe(400);
  });

  it("other people's blocks are invisible to you", async () => {
    const theirs = await planner.createBlock(db, { userId: samId }, { date: DAY, startMin: 0, endMin: 15, title: "sam's" });
    expect((await api("PATCH", `/api/time-blocks/${theirs.id}`, { title: "hijack" })).statusCode).toBe(404);
    expect((await api("DELETE", `/api/time-blocks/${theirs.id}`)).statusCode).toBe(404);
    const plan = (await api("GET", `/api/plan/${DAY}`)).json();
    expect(plan.blocks.map((b: { id: string }) => b.id)).not.toContain(theirs.id);
  });
});

describe("planned vs actual: captured when a block's start time arrives", () => {
  it("is free to move before it starts; the first change after start records the plan once", async () => {
    clock.freeze(at("10:00"));
    const b = (await block({ title: "deck", startMin: 630, endMin: 660 })).json(); // 10:30–11:00
    expect(b.plannedStartMin).toBeNull();

    const early = (await api("PATCH", `/api/time-blocks/${b.id}`, { startMin: 645, endMin: 675 })).json();
    expect(early.plannedStartMin).toBeNull(); // re-planning before it starts isn't "actual"

    clock.freeze(at("11:00")); // it has started (10:45)
    const moved = (await api("PATCH", `/api/time-blocks/${b.id}`, { startMin: 690, endMin: 720 })).json();
    expect(moved).toMatchObject({ plannedStartMin: 645, plannedEndMin: 675, startMin: 690, endMin: 720 });

    const again = (await api("PATCH", `/api/time-blocks/${b.id}`, { startMin: 720, endMin: 750 })).json();
    expect(again.plannedStartMin).toBe(645); // frozen after the first capture
  });

  it("reading a past day records the plan too, and logging after the fact counts as the plan", async () => {
    clock.freeze(at("10:00"));
    const later = (await block({ title: "later", startMin: 900, endMin: 930 })).json();
    const logged = (await block({ title: "already did it", startMin: 480, endMin: 540 })).json();
    expect(logged.plannedStartMin).toBe(480);

    clock.freeze(at("10:00") + 86_400_000); // next day
    const plan = (await api("GET", `/api/plan/${DAY}`)).json();
    expect(plan.blocks.find((x: { id: string }) => x.id === later.id).plannedStartMin).toBe(900);
  });

  it("status can be set any time, including on past days", async () => {
    clock.freeze(at("10:00") + 3 * 86_400_000);
    const b = (await db.select().from(timeBlocks).where(eq(timeBlocks.date, DAY)))[0]!;
    const r = await api("PATCH", `/api/time-blocks/${b.id}`, { status: "done" });
    expect(r.json().status).toBe("done");
  });
});

describe("a day's plan", () => {
  it("reports the zone, today and now in the user's time", async () => {
    clock.freeze(at("10:00"));
    const plan = (await api("GET", `/api/plan/${DAY}`)).json();
    expect(plan).toMatchObject({ date: DAY, timezone: "America/Denver", today: DAY, nowMin: 600 });
    const mins = plan.blocks.map((b: { startMin: number }) => b.startMin);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });

  it("shows every event you can see as fixed blocks in local minutes — clipped, all-day, not cancelled", async () => {
    const mk = (title: string, startsAt: number, endsAt: number, extra: object = {}) =>
      ({ id: newId(), title, startsAt, endsAt, createdBy: ownerId, ...extra });
    await db.insert(events).values([
      mk("Gymnastics", at("18:00"), at("19:30")),
      mk("Late shift", at("22:00"), at("22:00") + 4 * 3_600_000), // runs past midnight
      mk("Holiday", Date.UTC(2031, 0, 15), Date.UTC(2031, 0, 16), { allDay: true }),
      mk("Called off", at("12:00"), at("13:00"), { status: "cancelled" }),
      mk("Sam's private", at("09:00"), at("10:00"), { createdBy: samId }),
    ]);
    const plan = (await api("GET", `/api/plan/${DAY}`)).json();
    const byTitle = Object.fromEntries(plan.events.map((e: { title: string }) => [e.title, e]));
    expect(byTitle.Gymnastics).toMatchObject({ startMin: 1080, endMin: 1170, allDay: false });
    expect(byTitle["Late shift"]).toMatchObject({ startMin: 1320, endMin: 1440 });
    expect(byTitle.Holiday).toMatchObject({ allDay: true, startMin: 0, endMin: 1440 });
    expect(byTitle["Called off"]).toBeUndefined();
    expect(byTitle["Sam's private"]).toBeUndefined();

    // the next day shows the tail of the late shift, not the holiday
    const next = (await api("GET", "/api/plan/2031-01-16")).json();
    const titles = next.events.map((e: { title: string }) => e.title);
    expect(titles).toContain("Late shift");
    expect(titles).not.toContain("Holiday");
    expect(next.events.find((e: { title: string }) => e.title === "Late shift")).toMatchObject({ startMin: 0, endMin: 120 });
  });

  it("day notes save, read back, and clear", async () => {
    await api("PUT", `/api/plan/${DAY}/notes`, { body: "Deck slipped again." });
    expect((await api("GET", `/api/plan/${DAY}`)).json().notes).toBe("Deck slipped again.");
    await api("PUT", `/api/plan/${DAY}/notes`, { body: "Rewritten." });
    expect((await api("GET", `/api/plan/${DAY}`)).json().notes).toBe("Rewritten.");
    await api("PUT", `/api/plan/${DAY}/notes`, { body: "  " });
    expect((await api("GET", `/api/plan/${DAY}`)).json().notes).toBe("");
    expect((await api("GET", "/api/plan/2031-13-01")).statusCode).toBe(400);
  });
});

describe("timezone", () => {
  it("the browser's zone is saved and changes what 'today' means", async () => {
    clock.freeze(Date.parse("2031-01-16T03:00:00Z")); // 8 pm Jan 15 in Denver, 4 am Jan 16 in Berlin
    expect((await api("GET", `/api/plan/${DAY}`)).json().today).toBe("2031-01-15");
    expect((await api("PUT", "/api/me/timezone", { timezone: "Europe/Berlin" })).statusCode).toBe(200);
    expect((await api("GET", `/api/plan/${DAY}`)).json().today).toBe("2031-01-16");
    expect((await api("PUT", "/api/me/timezone", { timezone: "Mars/Olympus" })).statusCode).toBe(400);
    await api("PUT", "/api/me/timezone", { timezone: "America/Denver" });
  });
});

describe("planner + the rest of STOMP", () => {
  it("deleting a todo keeps its blocks, with the todo's title", async () => {
    const todo = (await app.inject({ method: "POST", url: "/api/todos", payload: { title: "Renew passport" } })).json();
    const b = (await block({ startMin: 120, endMin: 150, todoId: todo.id })).json();
    expect(b.title).toBeNull();
    await app.inject({ method: "DELETE", url: `/api/todos/${todo.id}` });
    const [row] = await db.select().from(timeBlocks).where(eq(timeBlocks.id, b.id));
    expect(row).toMatchObject({ todoId: null, title: "Renew passport" });
  });

  it("deleting a user removes their planner (it's private)", async () => {
    const { deleteUser } = await import("../src/services/users.js");
    const victim = newId();
    await db.insert(users).values({ id: victim, email: `planner-${victim}@x.test`, displayName: "P" });
    await planner.createBlock(db, { userId: victim }, { date: DAY, startMin: 0, endMin: 15, title: "mine" });
    await planner.saveDayNotes(db, { userId: victim }, DAY, "note");
    await planner.listCategories(db, { userId: victim });
    await deleteUser(db, { userId: ownerId }, victim);
    for (const t of [timeBlocks, dayNotes, categories]) {
      expect(await db.select().from(t).where(eq(t.userId, victim))).toEqual([]);
    }
  });
});
