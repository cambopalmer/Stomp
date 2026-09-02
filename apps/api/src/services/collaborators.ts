import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
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
import { accessibleProjectIds, type Ctx } from "./access.js";
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
    incomingKind: "shared_reference" as const,
    activityType: "reference" as const,
  },
} as const;

const creatorFieldOf = (kind: ShareKind) => (kind === "reference" ? "addedBy" : "createdBy");

type EntityRow = {
  id: string;
  title: string;
  workspaceId: string | null;
  projectId: string | null;
  [k: string]: unknown;
};

async function loadEntity(db: Db, kind: ShareKind, id: string): Promise<EntityRow> {
  const [row] = await db.select().from(config[kind].entity).where(eq(config[kind].entity.id, id)).limit(1);
  if (!row) throw NotFound(kind);
  return row as EntityRow;
}

async function loadOwned(db: Db, ctx: Ctx, kind: ShareKind, id: string): Promise<EntityRow> {
  const row = await loadEntity(db, kind, id);
  if (row[creatorFieldOf(kind)] !== ctx.userId) throw Forbidden("Only the creator can manage sharing");
  return row;
}

/** Creator, a current collaborator, or a member of the item's project may view sharing. */
async function assertCanView(db: Db, ctx: Ctx, kind: ShareKind, row: EntityRow) {
  if (row[creatorFieldOf(kind)] === ctx.userId) return;
  const [collab] = await db
    .select({ id: config[kind].collab.id })
    .from(config[kind].collab)
    .where(and(eq(config[kind].fk, row.id), eq(config[kind].collab.userId, ctx.userId)))
    .limit(1);
  if (collab) return;
  if (row.projectId) {
    const projIds = await accessibleProjectIds(db, ctx.userId);
    if (projIds.includes(row.projectId)) return;
  }
  throw NotFound(kind);
}

export async function listCollaborators(db: Db, ctx: Ctx, kind: ShareKind, id: string) {
  const c = config[kind];
  const entity = await loadEntity(db, kind, id);
  await assertCanView(db, ctx, kind, entity);

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

  const [existing] = await db
    .select({ id: c.collab.id })
    .from(c.collab)
    .where(and(eq(c.fk, id), eq(c.collab.userId, u.id)))
    .limit(1);

  if (existing) {
    // already shared with this person — only (maybe) update the role, no re-notify
    if (input.role) await db.update(c.collab).set({ role: input.role }).where(eq(c.collab.id, existing.id));
    return { ok: true, alreadyShared: true as const };
  }

  await db.insert(c.collab).values({
    id: newId(),
    [kind === "todo" ? "todoId" : kind === "event" ? "eventId" : "referenceId"]: id,
    userId: u.id,
    role: input.role,
    addedBy: ctx.userId,
    createdAt: clock.now(),
  } as typeof c.collab.$inferInsert);

  // Note in the recipient's *personal* inbox — they may not be in the item's workspace.
  await db.insert(incomingItems).values({
    id: newId(),
    workspaceId: null,
    title: `Shared with you: ${entity.title}`,
    body: null,
    kind: c.incomingKind,
    status: "unread",
    forUserId: u.id,
    createdBy: ctx.userId,
    projectId: null,
    sourceRef: `${kind}:${id}`,
    sourceMeta: null,
    linkedEntityType: kind,
    linkedEntityId: id,
    createdAt: clock.now(),
    triagedAt: null,
  });

  await notify(db, u.id, "share_invite", `${entity.title} was shared with you`, { type: kind, id });
  await logActivity(db, ctx.userId, c.activityType, id, "shared");
  return { ok: true, alreadyShared: false as const };
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

  const [ct, ce, cr] = await Promise.all([
    db.select({ id: todoCollaborators.todoId }).from(todoCollaborators).where(eq(todoCollaborators.userId, uid)),
    db.select({ id: eventCollaborators.eventId }).from(eventCollaborators).where(eq(eventCollaborators.userId, uid)),
    db
      .select({ id: referenceCollaborators.referenceId })
      .from(referenceCollaborators)
      .where(eq(referenceCollaborators.userId, uid)),
  ]);
  const collabTodoIds = ct.map((r) => r.id);
  const collabEventIds = ce.map((r) => r.id);
  const collabRefIds = cr.map((r) => r.id);

  const [sharedTodos, sharedEvents, sharedRefs] = await Promise.all([
    db
      .select()
      .from(todos)
      .where(
        and(
          ne(todos.createdBy, uid),
          or(eq(todos.assigneeId, uid), collabTodoIds.length ? inArray(todos.id, collabTodoIds) : sql`0`),
        ),
      ),
    collabEventIds.length
      ? db.select().from(events).where(and(ne(events.createdBy, uid), inArray(events.id, collabEventIds)))
      : Promise.resolve([] as (typeof events.$inferSelect)[]),
    collabRefIds.length
      ? db.select().from(references).where(and(ne(references.addedBy, uid), inArray(references.id, collabRefIds)))
      : Promise.resolve([] as (typeof references.$inferSelect)[]),
  ]);

  return { todos: sharedTodos, events: sharedEvents, references: sharedRefs };
}
