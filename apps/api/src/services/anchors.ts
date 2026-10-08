import { DAY_MIN } from "@stomp/shared";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { events, timeBlocks, users } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { addDaysIso, isTimeZone, localNow } from "../lib/day.js";

/*
 * Anchored blocks (ADR-0006, slice 5): a block can hang off an event at a
 * fixed offset from the event's start ("Drive · ends when gymnastics starts").
 *  - the event moves  → its blocks move with it (even to another day)
 *  - the event is cancelled, deleted, or dropped by a Google sync
 *      → its blocks are KEPT, un-anchored and flagged `anchor_lost`
 *    (a sync blip must never silently delete someone's plan)
 * Every place that changes or removes events calls in here.
 */

type EventRow = typeof events.$inferSelect;

async function zoneOf(db: Db, userId: string): Promise<string> {
  const [u] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.tz && isTimeZone(u.tz) ? u.tz : "UTC";
}

/** Where an event starts on its owner-of-the-block's wall clock. */
export async function eventLocalStart(db: Db, userId: string, ev: Pick<EventRow, "startsAt">) {
  return localNow(ev.startsAt, await zoneOf(db, userId));
}

/** Place a block at (event start + offset), normalised into a date + in-day minutes. */
function place(date: string, minute: number, duration: number): { date: string; startMin: number; endMin: number } {
  let d = date;
  let m = minute;
  while (m < 0) {
    m += DAY_MIN;
    d = addDaysIso(d, -1);
  }
  while (m >= DAY_MIN) {
    m -= DAY_MIN;
    d = addDaysIso(d, 1);
  }
  // blocks never cross midnight: keep the length, pull it back inside the day
  const start = Math.min(m, DAY_MIN - duration);
  return { date: d, startMin: start, endMin: start + duration };
}

/** Event still there and timed? Move its anchored blocks to follow it. Otherwise release them. */
export async function realignAnchors(db: Db, eventIds: string[]): Promise<void> {
  if (!eventIds.length) return;
  const evs = await db.select().from(events).where(inArray(events.id, eventIds));
  const byId = new Map(evs.map((e) => [e.id, e]));
  const gone = eventIds.filter((id) => {
    const e = byId.get(id);
    return !e || e.status === "cancelled" || e.allDay;
  });
  await releaseAnchors(db, gone);

  const live = evs.filter((e) => !gone.includes(e.id));
  if (!live.length) return;
  const anchored = await db.select().from(timeBlocks).where(inArray(timeBlocks.anchorEventId, live.map((e) => e.id)));
  for (const b of anchored) {
    const ev = byId.get(b.anchorEventId!)!;
    const at = await eventLocalStart(db, b.userId, ev);
    const next = place(at.date, at.minute + (b.anchorOffsetMin ?? 0), b.endMin - b.startMin);
    if (next.date === b.date && next.startMin === b.startMin && next.endMin === b.endMin) continue;
    await db
      .update(timeBlocks)
      .set({ ...next, updatedAt: clock.now() })
      .where(eq(timeBlocks.id, b.id));
  }
}

/** The event went away: keep the blocks, drop the anchor, flag them for a one-tap cleanup. */
export async function releaseAnchors(db: Db, eventIds: string[]): Promise<void> {
  if (!eventIds.length) return;
  await db
    .update(timeBlocks)
    .set({ anchorEventId: null, anchorOffsetMin: null, anchorLost: true, updatedAt: clock.now() })
    .where(inArray(timeBlocks.anchorEventId, eventIds));
}
