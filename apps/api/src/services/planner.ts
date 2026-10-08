import type {
  Category,
  DefaultCategory,
  CreateCategory,
  CreateTimeBlock,
  DayPlan,
  PlannerEvent,
  TimeBlock,
  TrayTodo,
  UpdateCategory,
  UpdateTimeBlock,
} from "@stomp/shared";
import { DAY_MIN } from "@stomp/shared";
import { and, asc, count, eq, gte, inArray, isNull, lt, ne, notInArray, or } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { categories, dayNotes, defaultCategories, events, timeBlocks, todos, users } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { dateBounds, isIsoDate, isTimeZone, localNow } from "../lib/day.js";
import { AppError, BadRequest, Conflict, NotFound } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import type { Ctx } from "./access.js";
import { eventLocalStart } from "./anchors.js";
import { eventsOnLocalDay, visibleEventsCond } from "./events.js";
import { getTodo, visibleTodosCond } from "./todos.js";

/*
 * Day planner (ADR-0006). Blocks are personal (user_id), wall-clock
 * (date + minutes, 15-min grid, never crossing midnight), and capture their
 * planned time automatically the first time they're touched after starting.
 */

type BlockRow = typeof timeBlocks.$inferSelect;
type CategoryRow = typeof categories.$inferSelect;

// ─────────────────────────────────────── timezone

export async function userTimezone(db: Db, userId: string): Promise<string> {
  const [u] = await db.select({ tz: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.tz && isTimeZone(u.tz) ? u.tz : "UTC";
}

/** The web app reports the browser's zone; keeps "today" right for wall-clock planning. */
export async function setTimezone(db: Db, ctx: Ctx, timezone: string): Promise<{ timezone: string }> {
  if (!isTimeZone(timezone)) throw BadRequest("Unknown time zone");
  await db.update(users).set({ timezone, updatedAt: clock.now() }).where(eq(users.id, ctx.userId));
  return { timezone };
}

// ─────────────────────────────────────── categories

const toCategory = (c: CategoryRow): Category => ({
  id: c.id,
  name: c.name,
  color: c.color as Category["color"],
  icon: c.icon as Category["icon"],
  sortOrder: c.sortOrder,
  archived: c.archivedAt != null,
});

/** First use: give the user their own copy of the hub defaults. */
async function ensureCategories(db: Db, userId: string): Promise<void> {
  const [{ n }] = (await db.select({ n: count() }).from(categories).where(eq(categories.userId, userId))) as [
    { n: number },
  ];
  if (n > 0) return;
  const defaults = await db.select().from(defaultCategories).orderBy(asc(defaultCategories.sortOrder));
  if (!defaults.length) return;
  const stamp = clock.now();
  await db
    .insert(categories)
    .values(
      defaults.map((d) => ({
        id: newId(),
        userId,
        name: d.name,
        color: d.color,
        icon: d.icon,
        sortOrder: d.sortOrder,
        defaultId: d.id,
        createdAt: stamp,
        updatedAt: stamp,
      })),
    )
    .onConflictDoNothing(); // two first requests at once
}

export async function listCategories(db: Db, ctx: Ctx): Promise<Category[]> {
  await ensureCategories(db, ctx.userId);
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, ctx.userId))
    .orderBy(asc(categories.sortOrder), asc(categories.createdAt));
  return rows.map(toCategory);
}

async function loadCategory(db: Db, ctx: Ctx, id: string): Promise<CategoryRow> {
  const [c] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, ctx.userId)))
    .limit(1);
  if (!c) throw NotFound("Category");
  return c;
}

/** drizzle wraps driver errors; the SQLite message lives somewhere on the cause chain. */
const nameTaken = (e: unknown): boolean => {
  for (let cur: unknown = e; cur instanceof Error; cur = (cur as Error & { cause?: unknown }).cause) {
    if (/UNIQUE constraint failed/.test(cur.message)) return true;
  }
  return false;
};

export async function createCategory(db: Db, ctx: Ctx, input: CreateCategory): Promise<Category> {
  await ensureCategories(db, ctx.userId);
  const [{ max }] = (await db
    .select({ max: count() })
    .from(categories)
    .where(eq(categories.userId, ctx.userId))) as [{ max: number }];
  const stamp = clock.now();
  const row = {
    id: newId(),
    userId: ctx.userId,
    name: input.name,
    color: input.color,
    icon: input.icon,
    sortOrder: max,
    createdAt: stamp,
    updatedAt: stamp,
  };
  try {
    await db.insert(categories).values(row);
  } catch (e) {
    if (nameTaken(e)) throw Conflict(`You already have a category named “${input.name}”`);
    throw e;
  }
  return toCategory({ ...row, defaultId: null, archivedAt: null });
}

export async function updateCategory(db: Db, ctx: Ctx, id: string, input: UpdateCategory): Promise<Category> {
  const current = await loadCategory(db, ctx, id);
  const set: Partial<CategoryRow> = { updatedAt: clock.now() };
  if (input.name !== undefined) set.name = input.name;
  if (input.color !== undefined) set.color = input.color;
  if (input.icon !== undefined) set.icon = input.icon;
  if (input.sortOrder !== undefined) set.sortOrder = input.sortOrder;
  if (input.archived !== undefined) set.archivedAt = input.archived ? (current.archivedAt ?? clock.now()) : null;
  try {
    await db.update(categories).set(set).where(eq(categories.id, id));
  } catch (e) {
    if (nameTaken(e)) throw Conflict(`You already have a category named “${input.name ?? current.name}”`);
    throw e;
  }
  return toCategory(await loadCategory(db, ctx, id));
}

/** Unused → deleted. Used → archived, so past days still render with it. */
export async function deleteCategory(db: Db, ctx: Ctx, id: string): Promise<{ archived: boolean }> {
  const c = await loadCategory(db, ctx, id);
  const [{ n }] = (await db.select({ n: count() }).from(timeBlocks).where(eq(timeBlocks.categoryId, id))) as [
    { n: number },
  ];
  if (n > 0) {
    await db.update(categories).set({ archivedAt: c.archivedAt ?? clock.now(), updatedAt: clock.now() }).where(eq(categories.id, id));
    return { archived: true };
  }
  await db.delete(categories).where(eq(categories.id, id));
  return { archived: false };
}

// ─────────────────────────────────────── blocks

type TodoInfo = NonNullable<TimeBlock["todo"]>;

/**
 * The linked todo as each block should show it — only todos the user can
 * still see, and how many of the user's blocks share each one.
 */
async function todoInfo(db: Db, ctx: Ctx, rows: BlockRow[]): Promise<Map<string, TodoInfo>> {
  const ids = [...new Set(rows.map((r) => r.todoId).filter((x): x is string => !!x))];
  const out = new Map<string, TodoInfo>();
  if (!ids.length) return out;
  const visible = await db
    .select({ id: todos.id, title: todos.title, status: todos.status })
    .from(todos)
    .where(and(inArray(todos.id, ids), await visibleTodosCond(db, ctx.userId)));
  const counts = await db
    .select({ id: timeBlocks.todoId, n: count() })
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, ctx.userId), inArray(timeBlocks.todoId, ids)))
    .groupBy(timeBlocks.todoId);
  const n = new Map(counts.map((c) => [c.id, c.n]));
  for (const t of visible) {
    out.set(t.id, { id: t.id, title: t.title, done: t.status === "done" || t.status === "cancelled", blockCount: n.get(t.id) ?? 1 });
  }
  return out;
}

async function withTodo(db: Db, ctx: Ctx, row: BlockRow): Promise<TimeBlock> {
  return toBlock(row, await todoInfo(db, ctx, [row]));
}

const toBlock = (b: BlockRow, info: Map<string, TodoInfo>): TimeBlock => ({
  id: b.id,
  date: b.date,
  startMin: b.startMin,
  endMin: b.endMin,
  plannedStartMin: b.plannedStartMin,
  plannedEndMin: b.plannedEndMin,
  title: b.title,
  notes: b.notes,
  categoryId: b.categoryId,
  todoId: b.todoId,
  anchorEventId: b.anchorEventId,
  anchorOffsetMin: b.anchorOffsetMin,
  anchorLost: b.anchorLost,
  status: b.status,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
  todo: (b.todoId && info.get(b.todoId)) || null,
});

/** Has this block's start time arrived (in the user's zone)? */
const hasStarted = (b: { date: string; startMin: number }, now: { date: string; minute: number }) =>
  b.date < now.date || (b.date === now.date && b.startMin <= now.minute);

/** Record the planned time once, the first time the block is touched after it starts (ADR-0006). */
async function captureIfStarted(db: Db, b: BlockRow, now: { date: string; minute: number }): Promise<BlockRow> {
  if (b.plannedStartMin != null || !hasStarted(b, now)) return b;
  await db
    .update(timeBlocks)
    .set({ plannedStartMin: b.startMin, plannedEndMin: b.endMin })
    .where(and(eq(timeBlocks.id, b.id), isNull(timeBlocks.plannedStartMin)));
  return { ...b, plannedStartMin: b.startMin, plannedEndMin: b.endMin };
}

async function loadBlock(db: Db, ctx: Ctx, id: string): Promise<BlockRow> {
  const [b] = await db
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, ctx.userId)))
    .limit(1);
  if (!b) throw NotFound("Block");
  return b;
}

function assertTimes(date: string, startMin: number, endMin: number) {
  if (!isIsoDate(date)) throw BadRequest("Not a real date");
  if (startMin < 0 || endMin > DAY_MIN || endMin <= startMin) {
    throw BadRequest("A block must end after it starts, within the same day");
  }
}

async function assertCategoryUsable(db: Db, ctx: Ctx, id: string | null | undefined) {
  if (!id) return;
  const c = await loadCategory(db, ctx, id);
  if (c.archivedAt != null) throw BadRequest("That category is archived");
}

/** You can only timebox a todo you can see. */
async function assertTodoVisible(db: Db, ctx: Ctx, id: string | null | undefined) {
  if (!id) return;
  try {
    await getTodo(db, ctx, id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) throw BadRequest("That todo isn't available");
    throw e;
  }
}

/**
 * An event a block may anchor to: visible to you, timed, not cancelled, and
 * starting on the block's day. Returns the event's local start minute.
 */
async function anchorStart(db: Db, ctx: Ctx, eventId: string, date: string): Promise<number> {
  const [ev] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), await visibleEventsCond(db, ctx.userId)))
    .limit(1);
  if (!ev) throw BadRequest("That event isn't available");
  if (ev.status === "cancelled" || ev.allDay) throw BadRequest("Blocks can only attach to timed, upcoming events");
  const at = await eventLocalStart(db, ctx.userId, ev);
  if (at.date !== date) throw BadRequest("An attached block has to be on the event's day");
  return at.minute;
}

export async function createBlock(db: Db, ctx: Ctx, input: CreateTimeBlock): Promise<TimeBlock> {
  assertTimes(input.date, input.startMin, input.endMin);
  const anchorAt = input.anchorEventId ? await anchorStart(db, ctx, input.anchorEventId, input.date) : null;
  const title = input.title?.trim() || null;
  if (!title && !input.todoId) throw BadRequest("Give the block a title or link a todo");
  await assertCategoryUsable(db, ctx, input.categoryId);
  await assertTodoVisible(db, ctx, input.todoId);

  const stamp = clock.now();
  const row: BlockRow = {
    id: newId(),
    userId: ctx.userId,
    workspaceId: null,
    date: input.date,
    startMin: input.startMin,
    endMin: input.endMin,
    plannedStartMin: null,
    plannedEndMin: null,
    title,
    notes: input.notes ?? null,
    categoryId: input.categoryId ?? null,
    todoId: input.todoId ?? null,
    anchorEventId: input.anchorEventId ?? null,
    anchorOffsetMin: anchorAt == null ? null : input.startMin - anchorAt,
    anchorLost: false,
    status: "planned",
    createdAt: stamp,
    updatedAt: stamp,
  };
  // logged after the fact (start already passed): what you entered is the plan
  const now = localNow(stamp, await userTimezone(db, ctx.userId));
  if (hasStarted(row, now)) {
    row.plannedStartMin = row.startMin;
    row.plannedEndMin = row.endMin;
  }
  await db.insert(timeBlocks).values(row);
  return withTodo(db, ctx, row);
}

export async function updateBlock(db: Db, ctx: Ctx, id: string, input: UpdateTimeBlock): Promise<TimeBlock> {
  const now = localNow(clock.now(), await userTimezone(db, ctx.userId));
  const current = await captureIfStarted(db, await loadBlock(db, ctx, id), now);

  const date = input.date ?? current.date;
  const startMin = input.startMin ?? current.startMin;
  const endMin = input.endMin ?? current.endMin;
  assertTimes(date, startMin, endMin);

  const title = input.title === undefined ? current.title : input.title?.trim() || null;
  const todoId = input.todoId === undefined ? current.todoId : input.todoId;
  if (!title && !todoId) throw BadRequest("Give the block a title or link a todo");
  if (input.categoryId !== undefined && input.categoryId !== current.categoryId) {
    await assertCategoryUsable(db, ctx, input.categoryId);
  }
  if (input.todoId !== undefined && input.todoId !== current.todoId) await assertTodoVisible(db, ctx, input.todoId);

  const set: Partial<BlockRow> = { date, startMin, endMin, title, todoId, updatedAt: clock.now() };
  if (input.anchorLost === false) set.anchorLost = false;
  // moving an attached block by hand re-anchors it at the new offset; another day detaches it
  if (current.anchorEventId && (date !== current.date || startMin !== current.startMin)) {
    const [ev] = await db.select().from(events).where(eq(events.id, current.anchorEventId)).limit(1);
    const at = ev ? await eventLocalStart(db, ctx.userId, ev) : null;
    if (at && at.date === date) set.anchorOffsetMin = startMin - at.minute;
    else Object.assign(set, { anchorEventId: null, anchorOffsetMin: null });
  }
  if (input.notes !== undefined) set.notes = input.notes;
  if (input.categoryId !== undefined) set.categoryId = input.categoryId;
  if (input.status !== undefined) set.status = input.status;
  await db.update(timeBlocks).set(set).where(eq(timeBlocks.id, id));
  return withTodo(db, ctx, await loadBlock(db, ctx, id));
}

export async function deleteBlock(db: Db, ctx: Ctx, id: string): Promise<void> {
  await loadBlock(db, ctx, id);
  await db.delete(timeBlocks).where(eq(timeBlocks.id, id));
}

// ─────────────────────────────────────── a day

/** Where an instant falls on `date`'s wall-clock grid, clamped to the day. */
function minuteOn(date: string, ms: number, tz: string): number {
  const at = localNow(ms, tz);
  if (at.date < date) return 0;
  if (at.date > date) return DAY_MIN;
  return at.minute;
}

export async function getDayPlan(db: Db, ctx: Ctx, date: string): Promise<DayPlan> {
  if (!isIsoDate(date)) throw BadRequest("Not a real date");
  const tz = await userTimezone(db, ctx.userId);
  const now = localNow(clock.now(), tz);

  const rows = await db
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, ctx.userId), eq(timeBlocks.date, date)))
    .orderBy(asc(timeBlocks.startMin), asc(timeBlocks.endMin));
  const captured: BlockRow[] = [];
  for (const r of rows) captured.push(await captureIfStarted(db, r, now));
  const info = await todoInfo(db, ctx, captured);
  const blocks = captured.map((r) => toBlock(r, info));

  // every event you can see — the planner ignores the workspace switcher (ADR-0006)
  const evs = await db
    .select()
    .from(events)
    .where(
      and(
        await visibleEventsCond(db, ctx.userId),
        ne(events.status, "cancelled"),
        eventsOnLocalDay(dateBounds(date, tz)),
      ),
    )
    .orderBy(asc(events.allDay), asc(events.startsAt));
  const plannerEvents: PlannerEvent[] = evs.map((e) => ({
    id: e.id,
    title: e.title,
    allDay: e.allDay,
    startMin: e.allDay ? 0 : minuteOn(date, e.startsAt, tz),
    endMin: e.allDay ? DAY_MIN : Math.max(minuteOn(date, e.endsAt, tz), minuteOn(date, e.startsAt, tz) + 1),
    location: e.location,
    fromGoogle: e.externalProvider === "google",
  }));

  const [note] = await db
    .select({ body: dayNotes.body })
    .from(dayNotes)
    .where(and(eq(dayNotes.userId, ctx.userId), eq(dayNotes.date, date)))
    .limit(1);

  const tray = await trayFor(db, ctx, date, tz, now.date, rows);

  return {
    date,
    timezone: tz,
    today: now.date,
    nowMin: now.minute,
    blocks,
    events: plannerEvents,
    tray,
    notes: note?.body ?? "",
  };
}

/** One note per day; saving an empty note removes it. */
export async function saveDayNotes(db: Db, ctx: Ctx, date: string, body: string): Promise<{ notes: string }> {
  if (!isIsoDate(date)) throw BadRequest("Not a real date");
  const where = and(eq(dayNotes.userId, ctx.userId), eq(dayNotes.date, date));
  if (!body.trim()) {
    await db.delete(dayNotes).where(where);
    return { notes: "" };
  }
  await db
    .insert(dayNotes)
    .values({ id: newId(), userId: ctx.userId, date, body, updatedAt: clock.now() })
    .onConflictDoUpdate({ target: [dayNotes.userId, dayNotes.date], set: { body, updatedAt: clock.now() } });
  return { notes: body };
}

// ─────────────────────────────────────── the tray (slice 3)


/**
 * Todos waiting for a time on `date` (ADR-0006: "today, no time yet" is a
 * todo with Plan for): open todos you can see that are planned for the day,
 * due that day, or — on today only — overdue. Ones already given a block that
 * day are left out; they're on the timeline.
 */
async function trayFor(
  db: Db,
  ctx: Ctx,
  date: string,
  tz: string,
  today: string,
  blocksThatDay: BlockRow[],
): Promise<TrayTodo[]> {
  const { dayStart, dayEnd } = dateBounds(date, tz);
  const reasons = [
    and(gte(todos.scheduledFor, dayStart), lt(todos.scheduledFor, dayEnd)),
    and(gte(todos.dueAt, dayStart), lt(todos.dueAt, dayEnd)),
  ];
  if (date === today) reasons.push(lt(todos.dueAt, dayStart));

  const rows = await db
    .select({
      id: todos.id,
      title: todos.title,
      priority: todos.priority,
      dueAt: todos.dueAt,
      scheduledFor: todos.scheduledFor,
    })
    .from(todos)
    .where(
      and(
        await visibleTodosCond(db, ctx.userId),
        notInArray(todos.status, ["done", "cancelled"]),
        or(...reasons),
      ),
    );

  const scheduled = new Set(blocksThatDay.map((b) => b.todoId).filter(Boolean));
  const rank = { overdue: 0, due: 1, planned: 2 } as const;
  const prio = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 } as const;
  return rows
    .filter((t) => !scheduled.has(t.id))
    .map((t): TrayTodo => {
      const reason: TrayTodo["reason"] =
        t.dueAt != null && t.dueAt < dayStart
          ? "overdue"
          : t.dueAt != null && t.dueAt < dayEnd
            ? "due"
            : "planned";
      return { id: t.id, title: t.title, priority: t.priority, reason, dueAt: t.dueAt };
    })
    .sort((a, b) => rank[a.reason] - rank[b.reason] || prio[a.priority] - prio[b.priority] || a.title.localeCompare(b.title));
}

// ─────────────────────────────────────── copy a day (slice 6)

/**
 * Stamp another day's plan onto `date` — a routine, not a roll-over (ADR-0006):
 * blocks arrive as fresh *planned* blocks; links to todos that are done or no
 * longer visible are dropped; anchors aren't copied (that event isn't today).
 */
export async function copyDay(db: Db, ctx: Ctx, date: string, fromDate: string): Promise<{ copied: number }> {
  if (!isIsoDate(date) || !isIsoDate(fromDate)) throw BadRequest("Not a real date");
  if (date === fromDate) throw BadRequest("Pick a different day to copy from");
  const source = await db
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, ctx.userId), eq(timeBlocks.date, fromDate)))
    .orderBy(asc(timeBlocks.startMin));
  if (!source.length) return { copied: 0 };

  const info = await todoInfo(db, ctx, source);
  const stamp = clock.now();
  const now = localNow(stamp, await userTimezone(db, ctx.userId));
  const rows: BlockRow[] = source.map((b) => {
    const t = b.todoId ? info.get(b.todoId) : undefined;
    const keepTodo = t && !t.done ? t.id : null;
    const row: BlockRow = {
      ...b,
      id: newId(),
      date,
      // an untitled block that loses its todo keeps the todo's title
      title: b.title ?? (keepTodo ? null : (t?.title ?? "Block")),
      todoId: keepTodo,
      anchorEventId: null,
      anchorOffsetMin: null,
      anchorLost: false,
      status: "planned",
      plannedStartMin: null,
      plannedEndMin: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    if (hasStarted(row, now)) {
      row.plannedStartMin = row.startMin;
      row.plannedEndMin = row.endMin;
    }
    return row;
  });
  await db.insert(timeBlocks).values(rows);
  return { copied: rows.length };
}

// ─────────────────────────────────────── hub default categories (admin, slice 6)

const toDefault = (d: typeof defaultCategories.$inferSelect): DefaultCategory => ({
  id: d.id,
  name: d.name,
  color: d.color as DefaultCategory["color"],
  icon: d.icon as DefaultCategory["icon"],
  sortOrder: d.sortOrder,
});

export async function listDefaultCategories(db: Db): Promise<DefaultCategory[]> {
  return (await db.select().from(defaultCategories).orderBy(asc(defaultCategories.sortOrder))).map(toDefault);
}

/**
 * Add a hub default. ADR-0006: additions reach everyone — every user who
 * already has categories gets a copy, unless they already have a live
 * category by that name (theirs wins). Users seeded later get it anyway.
 */
export async function addDefaultCategory(db: Db, input: CreateCategory): Promise<{ category: DefaultCategory; addedTo: number }> {
  const [{ n }] = (await db.select({ n: count() }).from(defaultCategories)) as [{ n: number }];
  const row = { id: newId(), name: input.name, color: input.color, icon: input.icon, sortOrder: n, createdAt: clock.now() };
  await db.insert(defaultCategories).values(row);

  const owners = await db.selectDistinct({ userId: categories.userId }).from(categories);
  let addedTo = 0;
  for (const { userId } of owners) {
    const [{ max }] = (await db.select({ max: count() }).from(categories).where(eq(categories.userId, userId))) as [{ max: number }];
    const res = await db
      .insert(categories)
      .values({
        id: newId(),
        userId,
        name: row.name,
        color: row.color,
        icon: row.icon,
        sortOrder: max,
        defaultId: row.id,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
      })
      .onConflictDoNothing() // they already have a live one by that name
      .returning({ id: categories.id });
    addedTo += res.length;
  }
  return { category: toDefault(row), addedTo };
}

/** Rename / recolour / reorder a default. Never touches users' existing categories. */
export async function updateDefaultCategory(db: Db, id: string, input: UpdateCategory): Promise<DefaultCategory> {
  const set: Partial<typeof defaultCategories.$inferInsert> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.color !== undefined) set.color = input.color;
  if (input.icon !== undefined) set.icon = input.icon;
  if (input.sortOrder !== undefined) set.sortOrder = input.sortOrder;
  if (Object.keys(set).length) await db.update(defaultCategories).set(set).where(eq(defaultCategories.id, id));
  const [d] = await db.select().from(defaultCategories).where(eq(defaultCategories.id, id)).limit(1);
  if (!d) throw NotFound("Default category");
  return toDefault(d);
}

/** Remove a default for future users only — existing copies stay (categories.default_id → null). */
export async function deleteDefaultCategory(db: Db, id: string): Promise<void> {
  const [d] = await db.select({ id: defaultCategories.id }).from(defaultCategories).where(eq(defaultCategories.id, id)).limit(1);
  if (!d) throw NotFound("Default category");
  await db.update(categories).set({ defaultId: null }).where(eq(categories.defaultId, id));
  await db.delete(defaultCategories).where(eq(defaultCategories.id, id));
}
