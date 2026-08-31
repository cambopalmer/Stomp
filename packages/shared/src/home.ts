import { z } from "zod";
import { epochMs, id, priority } from "./common.js";

/** Tile counts for the home screen. */
export const homeSummary = z.object({
  calendar: z.object({ today: z.number().int(), upcoming: z.number().int() }),
  todos: z.object({ open: z.number().int(), dueToday: z.number().int(), overdue: z.number().int() }),
  incoming: z.object({ unread: z.number().int() }),
  learn: z.object({ total: z.number().int(), learning: z.number().int() }),
  projects: z.object({ active: z.number().int() }),
});
export type HomeSummary = z.infer<typeof homeSummary>;

export const hotBucket = z.enum(["overdue", "urgent", "due_today", "high", "scheduled_today"]);

export const hotTodo = z.object({
  id,
  title: z.string(),
  priority,
  dueAt: epochMs.nullable(),
  scheduledFor: epochMs.nullable(),
  bucket: hotBucket,
});

export const hotIncoming = z.object({
  id,
  title: z.string(),
  kind: z.string(),
  createdAt: epochMs,
});

export const hotEvent = z.object({
  id,
  title: z.string(),
  startsAt: epochMs,
  endsAt: epochMs,
  allDay: z.boolean(),
});

/** Payload for the "hot & relevant" sidebar. */
export const hotList = z.object({
  todos: z.array(hotTodo),
  incoming: z.array(hotIncoming),
  events: z.array(hotEvent),
});
export type HotList = z.infer<typeof hotList>;
