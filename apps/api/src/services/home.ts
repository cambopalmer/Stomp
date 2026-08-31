import type { HomeSummary, HotList } from "@stomp/shared";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { eventCollaborators, events, incomingItems, projects, references, todoCollaborators, todos } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { dayBounds } from "../lib/day.js";
import { accessibleProjectIds, type Ctx } from "./access.js";

async function visibleTodoConds(db: Db, userId: string) {
  const projIds = await accessibleProjectIds(db, userId);
  const collab = await db
    .select({ id: todoCollaborators.todoId })
    .from(todoCollaborators)
    .where(eq(todoCollaborators.userId, userId));
  const collabIds = collab.map((c) => c.id);
  return or(
    eq(todos.createdBy, userId),
    eq(todos.assigneeId, userId),
    projIds.length ? inArray(todos.projectId, projIds) : sql`0`,
    collabIds.length ? inArray(todos.id, collabIds) : sql`0`,
  );
}

export async function homeSummary(db: Db, ctx: Ctx, timezone: string): Promise<HomeSummary> {
  const now = clock.now();
  const { dayStart, dayEnd } = dayBounds(now, timezone);
  const vis = await visibleTodoConds(db, ctx.userId);
  const open = and(vis, ne(todos.status, "done"), ne(todos.status, "cancelled"), isNull(todos.parentTodoId));

  const projIds = await accessibleProjectIds(db, ctx.userId);
  const evVisible = or(
    eq(events.createdBy, ctx.userId),
    projIds.length ? inArray(events.projectId, projIds) : sql`0`,
  );

  const one = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);

  const [
    todosOpen, dueToday, overdue,
    calToday, calUpcoming,
    incUnread,
    refTotal, refLearning,
    projActive,
  ] = await Promise.all([
    one(db.select({ n: sql<number>`count(*)` }).from(todos).where(open)),
    one(db.select({ n: sql<number>`count(*)` }).from(todos).where(and(open, gte(todos.dueAt, dayStart), lt(todos.dueAt, dayEnd)))),
    one(db.select({ n: sql<number>`count(*)` }).from(todos).where(and(open, lt(todos.dueAt, dayStart)))),
    one(db.select({ n: sql<number>`count(*)` }).from(events).where(and(evVisible, ne(events.status, "cancelled"), lt(events.startsAt, dayEnd), gte(events.endsAt, dayStart)))),
    one(db.select({ n: sql<number>`count(*)` }).from(events).where(and(evVisible, ne(events.status, "cancelled"), gte(events.startsAt, dayEnd)))),
    one(db.select({ n: sql<number>`count(*)` }).from(incomingItems).where(and(eq(incomingItems.forUserId, ctx.userId), eq(incomingItems.status, "unread")))),
    one(db.select({ n: sql<number>`count(*)` }).from(references).where(await refVisible(db, ctx.userId))),
    one(db.select({ n: sql<number>`count(*)` }).from(references).where(and(await refVisible(db, ctx.userId), eq(references.status, "learning")))),
    one(db.select({ n: sql<number>`count(*)` }).from(projects).where(projIds.length ? and(inArray(projects.id, projIds), eq(projects.status, "active")) : sql`0`)),
  ]);

  return {
    calendar: { today: calToday, upcoming: calUpcoming },
    todos: { open: todosOpen, dueToday, overdue },
    incoming: { unread: incUnread },
    learn: { total: refTotal, learning: refLearning },
    projects: { active: projActive },
  };
}

async function refVisible(db: Db, userId: string) {
  const projIds = await accessibleProjectIds(db, userId);
  return or(
    eq(references.addedBy, userId),
    projIds.length ? inArray(references.projectId, projIds) : sql`0`,
  );
}

export async function hotList(db: Db, ctx: Ctx, timezone: string): Promise<HotList> {
  const now = clock.now();
  const { dayStart, dayEnd } = dayBounds(now, timezone);
  const vis = await visibleTodoConds(db, ctx.userId);
  const open = and(vis, ne(todos.status, "done"), ne(todos.status, "cancelled"), isNull(todos.parentTodoId));

  const rows = await db
    .select()
    .from(todos)
    .where(
      and(
        open,
        or(
          lt(todos.dueAt, dayEnd),
          inArray(todos.priority, ["high", "urgent"]),
          and(gte(todos.scheduledFor, dayStart), lt(todos.scheduledFor, dayEnd)),
        ),
      ),
    )
    .orderBy(asc(todos.dueAt), desc(todos.priority))
    .limit(50);

  const bucketed = rows.map((t) => {
    let bucket: HotList["todos"][number]["bucket"] = "scheduled_today";
    if (t.dueAt != null && t.dueAt < dayStart) bucket = "overdue";
    else if (t.priority === "urgent") bucket = "urgent";
    else if (t.dueAt != null && t.dueAt >= dayStart && t.dueAt < dayEnd) bucket = "due_today";
    else if (t.priority === "high") bucket = "high";
    return {
      id: t.id, title: t.title, priority: t.priority,
      dueAt: t.dueAt, scheduledFor: t.scheduledFor, bucket,
    };
  });
  const order = { overdue: 0, urgent: 1, due_today: 2, high: 3, scheduled_today: 4 };
  bucketed.sort((a, b) => order[a.bucket] - order[b.bucket]);

  const incoming = await db
    .select({ id: incomingItems.id, title: incomingItems.title, kind: incomingItems.kind, createdAt: incomingItems.createdAt })
    .from(incomingItems)
    .where(and(eq(incomingItems.forUserId, ctx.userId), eq(incomingItems.status, "unread")))
    .orderBy(desc(incomingItems.createdAt))
    .limit(20);

  const projIds = await accessibleProjectIds(db, ctx.userId);
  const todayEvents = await db
    .select({ id: events.id, title: events.title, startsAt: events.startsAt, endsAt: events.endsAt, allDay: events.allDay })
    .from(events)
    .where(
      and(
        ne(events.status, "cancelled"),
        lt(events.startsAt, dayEnd),
        gte(events.endsAt, dayStart),
        or(eq(events.createdBy, ctx.userId), projIds.length ? inArray(events.projectId, projIds) : sql`0`),
      ),
    )
    .orderBy(asc(events.startsAt));

  return { todos: bucketed, incoming, events: todayEvents };
}
