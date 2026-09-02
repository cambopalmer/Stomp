import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { events, notifications, todoCollaborators, todos } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { dayBounds } from "../lib/day.js";
import { newId } from "../lib/ids.js";
import { accessibleProjectIds, type Ctx } from "./access.js";
import { visibleEventsCond } from "./events.js";

type NType =
  | "share_invite"
  | "assignment"
  | "event_reminder"
  | "past_due"
  | "needs_attention"
  | "mention"
  | "system";

export interface NotificationView {
  id: string;
  type: NType;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: number;
  /** stored + unread, or a computed (transient) notification */
  read: boolean;
  transient: boolean;
}

/** Producer: called by mutations. */
export async function notify(
  db: Db,
  userId: string,
  type: NType,
  title: string,
  entity?: { type: string; id: string },
  body?: string,
): Promise<void> {
  if (userId) {
    await db.insert(notifications).values({
      id: newId(),
      userId,
      type,
      title,
      body: body ?? null,
      entityType: (entity?.type ?? null) as never,
      entityId: entity?.id ?? null,
      deliverAt: null,
      readAt: null,
      dismissedAt: null,
      createdAt: clock.now(),
    });
  }
}

async function computeTransient(db: Db, ctx: Ctx, timezone: string): Promise<NotificationView[]> {
  const now = clock.now();
  const { dayEnd } = dayBounds(now, timezone);
  const projIds = await accessibleProjectIds(db, ctx.userId);
  const collabIds = (
    await db.select({ id: todoCollaborators.todoId }).from(todoCollaborators).where(eq(todoCollaborators.userId, ctx.userId))
  ).map((r) => r.id);

  const mine = or(
    eq(todos.createdBy, ctx.userId),
    eq(todos.assigneeId, ctx.userId),
    projIds.length ? inArray(todos.projectId, projIds) : sql`0`,
    collabIds.length ? inArray(todos.id, collabIds) : sql`0`,
  );

  const overdue = await db
    .select({ id: todos.id, title: todos.title, dueAt: todos.dueAt })
    .from(todos)
    .where(and(mine, ne(todos.status, "done"), ne(todos.status, "cancelled"), lt(todos.dueAt, now)))
    .orderBy(todos.dueAt)
    .limit(20);

  const soon = await db
    .select({ id: events.id, title: events.title, startsAt: events.startsAt })
    .from(events)
    .where(
      and(
        ne(events.status, "cancelled"),
        await visibleEventsCond(db, ctx.userId), // creator / project / collaborator
        sql`${events.startsAt} >= ${now}`,
        lt(events.startsAt, dayEnd),
      ),
    )
    .orderBy(events.startsAt)
    .limit(20);

  return [
    ...overdue.map((t) => ({
      id: `pastdue:${t.id}`,
      type: "past_due" as const,
      title: `Past due: ${t.title}`,
      body: null,
      entityType: "todo",
      entityId: t.id,
      createdAt: t.dueAt ?? now,
      read: false,
      transient: true,
    })),
    ...soon.map((e) => ({
      id: `reminder:${e.id}`,
      type: "event_reminder" as const,
      title: `Today: ${e.title}`,
      body: null,
      entityType: "event",
      entityId: e.id,
      createdAt: e.startsAt,
      read: false,
      transient: true,
    })),
  ];
}

export async function listNotifications(db: Db, ctx: Ctx, timezone: string) {
  const stored = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, ctx.userId), isNull(notifications.dismissedAt)))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const storedViews: NotificationView[] = stored.map((n) => ({
    id: n.id,
    type: n.type as NType,
    title: n.title,
    body: n.body,
    entityType: n.entityType,
    entityId: n.entityId,
    createdAt: n.createdAt,
    read: n.readAt != null,
    transient: false,
  }));

  const transient = await computeTransient(db, ctx, timezone);
  const items = [...storedViews, ...transient].sort((a, b) => b.createdAt - a.createdAt);
  const unread = items.filter((i) => !i.read).length;
  return { items, unread };
}

export async function markRead(db: Db, ctx: Ctx, id: string) {
  await db
    .update(notifications)
    .set({ readAt: clock.now() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, ctx.userId)));
  return { ok: true };
}

export async function markAllRead(db: Db, ctx: Ctx) {
  await db
    .update(notifications)
    .set({ readAt: clock.now() })
    .where(and(eq(notifications.userId, ctx.userId), isNull(notifications.readAt)));
  return { ok: true };
}
