import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import {
  eventCollaborators,
  events,
  incomingItems,
  referenceCollaborators,
  references,
  todoCollaborators,
  todos,
  users,
} from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { BadRequest, Forbidden, NotFound } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import type { Ctx } from "./access.js";
import { logActivity } from "./activity.js";
import { notify } from "./notifications.js";

export type ShareKind = "todo" | "event" | "reference";

const config = {
  todo: {
    entity: todos,
    collab: todoCollaborators,
    fk: todoCollaborators.todoId,
    creatorCol: todos.createdBy,
    incomingKind: "shared_task" as const,
    activityType: "todo" as const,
  },
  event: {
    entity: events,
    collab: eventCollaborators,
    fk: eventCollaborators.eventId,
    creatorCol: events.createdBy,
    incomingKind: "shared_event" as const,
    activityType: "event" as const,
  },
  reference: {
    entity: references,
    collab: referenceCollaborators,
    fk: referenceCollaborators.referenceId,
    creatorCol: references.addedBy,
    incomingKind: "system" as const,
    activityType: "reference" as const,
  },
} as const;

async function loadOwned(db: Db, ctx: Ctx, kind: ShareKind, id: string) {
  const c = config[kind];
  const [row] = await db.select().from(c.entity).where(eq(c.entity.id, id)).limit(1);
  if (!row) throw NotFound(kind);
  const creator = (row as Record<string, unknown>)[
    kind === "reference" ? "addedBy" : "createdBy"
  ] as string;
  if (creator !== ctx.userId) throw Forbidden("Only the creator can manage sharing");
  return row as { id: string; title: string; workspaceId: string | null; projectId: string | null };
}

export async function listCollaborators(db: Db, ctx: Ctx, kind: ShareKind, id: string) {
  const c = config[kind];
  // visibility: creator or an existing collaborator may view the list
  const [entity] = await db.select().from(c.entity).where(eq(c.entity.id, id)).limit(1);
  if (!entity) throw NotFound(kind);

  const rows = await db
    .select({
      userId: c.collab.userId,
      role: c.collab.role,
      displayName: users.displayName,
      email: users.email,
    })
    .from(c.collab)
    .innerJoin(users, eq(users.id, c.collab.userId))
    .where(eq(c.fk, id))
    .orderBy(users.displayName);
  return rows;
}

export async function addCollaborator(
  db: Db,
  ctx: Ctx,
  kind: ShareKind,
  id: string,
  input: { email: string; role: "editor" | "viewer" },
) {
  const c = config[kind];
  const entity = await loadOwned(db, ctx, kind, id);

  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);
  if (!u) throw BadRequest("No user with that email. They need an account first (Phase 3).");
  if (u.id === ctx.userId) throw BadRequest("You already have access");

  await db
    .insert(c.collab)
    .values({
      id: newId(),
      [kind === "todo" ? "todoId" : kind === "event" ? "eventId" : "referenceId"]: id,
      userId: u.id,
      role: input.role,
      addedBy: ctx.userId,
      createdAt: clock.now(),
    } as typeof c.collab.$inferInsert)
    .onConflictDoNothing();

  // Drop a note in the recipient's inbox (until the notifications surface exists).
  await db.insert(incomingItems).values({
    id: newId(),
    workspaceId: entity.workspaceId ?? null,
    title: `Shared with you: ${entity.title}`,
    body: null,
    kind: c.incomingKind,
    status: "unread",
    forUserId: u.id,
    createdBy: ctx.userId,
    projectId: entity.projectId ?? null,
    sourceRef: `${kind}:${id}`,
    sourceMeta: null,
    linkedEntityType: kind === "reference" ? null : (kind as "todo" | "event"),
    linkedEntityId: kind === "reference" ? null : id,
    createdAt: clock.now(),
    triagedAt: null,
  });

  await notify(
    db,
    u.id,
    "share_invite",
    `${entity.title} was shared with you`,
    kind === "reference" ? undefined : { type: kind, id },
  );
  await logActivity(db, ctx.userId, c.activityType, id, "shared");
  return { ok: true };
}

export async function removeCollaborator(
  db: Db,
  ctx: Ctx,
  kind: ShareKind,
  id: string,
  userId: string,
) {
  const c = config[kind];
  await loadOwned(db, ctx, kind, id);
  await db.delete(c.collab).where(and(eq(c.fk, id), eq(c.collab.userId, userId)));
  return { ok: true };
}

/** Give up your own access to a shared item (used when declining a share). */
export async function leaveShare(db: Db, ctx: Ctx, kind: ShareKind, id: string) {
  const c = config[kind];
  await db.delete(c.collab).where(and(eq(c.fk, id), eq(c.collab.userId, ctx.userId)));
  return { ok: true };
}

/** Items shared *to* the current user (they're a collaborator or assignee, but not the creator). */
export async function sharedWithMe(db: Db, ctx: Ctx) {
  const uid = ctx.userId;

  const collabTodoIds = (
    await db.select({ id: todoCollaborators.todoId }).from(todoCollaborators).where(eq(todoCollaborators.userId, uid))
  ).map((r) => r.id);
  const collabEventIds = (
    await db.select({ id: eventCollaborators.eventId }).from(eventCollaborators).where(eq(eventCollaborators.userId, uid))
  ).map((r) => r.id);
  const collabRefIds = (
    await db
      .select({ id: referenceCollaborators.referenceId })
      .from(referenceCollaborators)
      .where(eq(referenceCollaborators.userId, uid))
  ).map((r) => r.id);

  const allTodos = await db.select().from(todos);
  const allEvents = await db.select().from(events);
  const allRefs = await db.select().from(references);

  return {
    todos: allTodos.filter(
      (t) => t.createdBy !== uid && (t.assigneeId === uid || collabTodoIds.includes(t.id)),
    ),
    events: allEvents.filter((e) => e.createdBy !== uid && collabEventIds.includes(e.id)),
    references: allRefs.filter((r) => r.addedBy !== uid && collabRefIds.includes(r.id)),
  };
}
