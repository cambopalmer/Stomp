import { z } from "zod";
import { epochMs, id, isoDate } from "./common.js";

/*
 * Day planner (ADR-0006). Wall-clock time: a local `date` plus minutes since
 * local midnight on a 15-minute grid, never crossing midnight.
 */

export const SLOT_MIN = 15;
export const DAY_MIN = 24 * 60;

/** Curated palette — the web maps each key to light/dark-safe tokens. */
export const categoryColor = z.enum([
  "blue",
  "violet",
  "amber",
  "orange",
  "rose",
  "teal",
  "green",
  "sky",
  "slate",
  "fuchsia",
]);
export type CategoryColor = z.infer<typeof categoryColor>;

/** Curated icons (meaning never by colour alone) — the web maps keys to lucide icons. */
export const categoryIcon = z.enum([
  "briefcase",
  "target",
  "clipboard",
  "home",
  "users",
  "user",
  "heart-pulse",
  "car",
  "book",
  "coffee",
  "dumbbell",
  "utensils",
  "music",
  "star",
  "moon",
  "phone",
  "graduation-cap",
  "shopping-cart",
  "sparkles",
]);
export type CategoryIcon = z.infer<typeof categoryIcon>;

/** The hub's initial defaults (also inserted by migration 0009 with these ids). */
export const SEED_DEFAULT_CATEGORIES = [
  { id: "0d9a1f10-0000-4000-8000-000000000001", name: "Work", color: "blue", icon: "briefcase" },
  { id: "0d9a1f10-0000-4000-8000-000000000002", name: "Focus", color: "violet", icon: "target" },
  { id: "0d9a1f10-0000-4000-8000-000000000003", name: "Admin & errands", color: "amber", icon: "clipboard" },
  { id: "0d9a1f10-0000-4000-8000-000000000004", name: "Chores", color: "orange", icon: "home" },
  { id: "0d9a1f10-0000-4000-8000-000000000005", name: "Family", color: "rose", icon: "users" },
  { id: "0d9a1f10-0000-4000-8000-000000000006", name: "Personal", color: "teal", icon: "user" },
  { id: "0d9a1f10-0000-4000-8000-000000000007", name: "Health", color: "green", icon: "heart-pulse" },
  { id: "0d9a1f10-0000-4000-8000-000000000008", name: "Travel", color: "sky", icon: "car" },
] as const satisfies readonly { id: string; name: string; color: CategoryColor; icon: CategoryIcon }[];

export const category = z.object({
  id,
  name: z.string(),
  color: categoryColor,
  icon: categoryIcon,
  sortOrder: z.number().int(),
  archived: z.boolean(),
});
export type Category = z.infer<typeof category>;

export const createCategory = z.object({
  name: z.string().trim().min(1, "Required").max(40),
  color: categoryColor,
  icon: categoryIcon,
});
export type CreateCategory = z.infer<typeof createCategory>;

export const updateCategory = createCategory.partial().extend({
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
});
export type UpdateCategory = z.infer<typeof updateCategory>;

const minuteOfDay = z
  .number()
  .int()
  .min(0)
  .max(DAY_MIN)
  .refine((m) => m % SLOT_MIN === 0, "Times snap to 15 minutes");

export const blockStatus = z.enum(["planned", "done", "skipped"]);
export type BlockStatus = z.infer<typeof blockStatus>;

export const timeBlock = z.object({
  id,
  date: isoDate,
  startMin: z.number().int(),
  endMin: z.number().int(),
  plannedStartMin: z.number().int().nullable(),
  plannedEndMin: z.number().int().nullable(),
  title: z.string().nullable(),
  notes: z.string().nullable(),
  categoryId: id.nullable(),
  todoId: id.nullable(),
  anchorEventId: id.nullable(),
  anchorOffsetMin: z.number().int().nullable(),
  anchorLost: z.boolean(),
  status: blockStatus,
  createdAt: epochMs,
  updatedAt: epochMs,
  /** the linked todo as the planner shows it (null when unlinked / not visible) */
  todo: z
    .object({
      id,
      title: z.string(),
      done: z.boolean(),
      /** how many blocks link to this todo — "also complete it?" defaults to yes when it's 1 */
      blockCount: z.number().int(),
    })
    .nullable(),
});
export type TimeBlock = z.infer<typeof timeBlock>;

const blockTimes = z
  .object({ date: isoDate, startMin: minuteOfDay, endMin: minuteOfDay })
  .refine((b) => b.endMin > b.startMin, { message: "End must be after start", path: ["endMin"] });

export const createTimeBlock = blockTimes.and(
  z.object({
    title: z.string().trim().max(200).nullish(),
    notes: z.string().max(5_000).nullish(),
    categoryId: id.nullish(),
    todoId: id.nullish(),
    /** "Add before…": hang this block off an event; the server records the offset */
    anchorEventId: id.nullish(),
  }),
);
export type CreateTimeBlock = z.infer<typeof createTimeBlock>;

export const updateTimeBlock = z.object({
  date: isoDate.optional(),
  startMin: minuteOfDay.optional(),
  endMin: minuteOfDay.optional(),
  title: z.string().trim().max(200).nullish(),
  notes: z.string().max(5_000).nullish(),
  categoryId: id.nullish(),
  todoId: id.nullish(),
  status: blockStatus.optional(),
  /** dismiss the "its event was cancelled" flag (keep the block as a plain one) */
  anchorLost: z.literal(false).optional(),
});
export type UpdateTimeBlock = z.infer<typeof updateTimeBlock>;

/** A calendar event as the planner draws it: a fixed block on this local day. */
export const plannerEvent = z.object({
  id,
  title: z.string(),
  allDay: z.boolean(),
  /** clipped to this day, local minutes; all-day events span 0–1440 */
  startMin: z.number().int(),
  endMin: z.number().int(),
  location: z.string().nullable(),
  fromGoogle: z.boolean(),
});
export type PlannerEvent = z.infer<typeof plannerEvent>;

/** A todo waiting to be given a time on this day (the planner's tray). */
export const trayTodo = z.object({
  id,
  title: z.string(),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]),
  /** why it's in today's tray */
  reason: z.enum(["planned", "due", "overdue"]),
  dueAt: epochMs.nullable(),
});
export type TrayTodo = z.infer<typeof trayTodo>;

export const dayPlan = z.object({
  date: isoDate,
  timezone: z.string(),
  /** "now" in the user's timezone — lets the client draw the now-line and know past/future */
  today: isoDate,
  nowMin: z.number().int(),
  blocks: z.array(timeBlock),
  events: z.array(plannerEvent),
  tray: z.array(trayTodo),
  notes: z.string(),
});
export type DayPlan = z.infer<typeof dayPlan>;

export const dayNotesInput = z.object({ body: z.string().max(10_000) });
export type DayNotesInput = z.infer<typeof dayNotesInput>;

export const timezoneInput = z.object({ timezone: z.string().min(1).max(64) });
export type TimezoneInput = z.infer<typeof timezoneInput>;
