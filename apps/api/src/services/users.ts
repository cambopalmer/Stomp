import type { AdminUpdateUser, AdminUser } from "@stomp/shared";
import { and, asc, count, eq, isNull, ne } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { Db } from "../db/client.js";
import {
  eventAttendees,
  eventCollaborators,
  events,
  incomingItems,
  integrationAccounts,
  notifications,
  projectMembers,
  projects,
  referenceCollaborators,
  references,
  sessions,
  tags,
  todoCollaborators,
  todos,
  users,
  workspaceMembers,
  workspaces,
  timeBlocks,
  dayNotes,
  categories,
} from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { BadRequest, Forbidden, NotFound } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import type { Ctx } from "./access.js";
import { hashPassword } from "./auth.js";
import { purgePolymorphicRefs } from "./cleanup.js";
import { releaseAnchors } from "./anchors.js";
import { keepMirrorsAsOwn } from "./integrations.js";
import { purgeTodoTree } from "./todos.js";

/*
 * Admin = user management only. Nothing here reads anyone's todos / events /
 * references for display; the admin never bypasses the visibility model.
 */

type UserRow = typeof users.$inferSelect;

export function toAdminUser(u: UserRow): AdminUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    hasPassword: u.passwordHash != null,
    googleLinked: u.googleId != null,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    disabledAt: u.disabledAt,
    deletedAt: u.deletedAt,
  };
}

export async function assertAdmin(db: Db, ctx: Ctx): Promise<void> {
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, ctx.userId)).limit(1);
  if (me?.role !== "admin") throw Forbidden("Admins only");
}

async function loadUser(db: Db, id: string): Promise<UserRow> {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u || u.deletedAt != null) throw NotFound("User");
  return u;
}

const isActiveAdmin = (u: UserRow) => u.role === "admin" && u.disabledAt == null && u.deletedAt == null;

/** Refuse a change that would leave the install with no active admin. */
async function assertNotLastAdmin(db: Db, target: UserRow): Promise<void> {
  if (!isActiveAdmin(target)) return;
  const [{ n }] = (await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), isNull(users.disabledAt), isNull(users.deletedAt)))) as [{ n: number }];
  if (n <= 1) throw BadRequest("That's the last admin — make someone else an admin first");
}

export async function listUsers(db: Db, ctx: Ctx): Promise<AdminUser[]> {
  await assertAdmin(db, ctx);
  const rows = await db.select().from(users).orderBy(asc(users.createdAt), asc(users.email));
  return rows.map(toAdminUser);
}

export async function updateUser(db: Db, ctx: Ctx, id: string, patch: AdminUpdateUser): Promise<AdminUser> {
  await assertAdmin(db, ctx);
  const target = await loadUser(db, id);
  const demoting = patch.role === "member" && target.role === "admin";
  const disabling = patch.disabled === true && target.disabledAt == null;
  if (disabling && id === ctx.userId) throw BadRequest("You can't disable your own account");
  if (demoting || disabling) await assertNotLastAdmin(db, target);

  const set: Partial<UserRow> = { updatedAt: clock.now() };
  if (patch.role) set.role = patch.role;
  if (patch.disabled !== undefined) set.disabledAt = patch.disabled ? (target.disabledAt ?? clock.now()) : null;
  await db.update(users).set(set).where(eq(users.id, id));
  if (disabling) await db.delete(sessions).where(eq(sessions.userId, id)); // sign them out everywhere

  logger.info({ actor: ctx.userId, target: id, patch }, "admin updated user");
  return toAdminUser(await loadUser(db, id));
}

/** Set a new password; the user's other sessions are signed out. */
export async function resetPassword(db: Db, ctx: Ctx, id: string, password: string): Promise<void> {
  await assertAdmin(db, ctx);
  await loadUser(db, id);
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), updatedAt: clock.now() })
    .where(eq(users.id, id));
  if (id !== ctx.userId) await db.delete(sessions).where(eq(sessions.userId, id));
  logger.info({ actor: ctx.userId, target: id }, "admin reset password");
}

/* ── delete = anonymize ──────────────────────────────────────────────────
 *
 * The users row stays as a tombstone ("Deleted user", no email / password /
 * Google link) so anything other people can still see keeps a valid author.
 * What goes vs. stays follows the visibility model (ADR-0003): an item the
 * deleted user created is deleted if nobody else can currently see it, and
 * kept otherwise. Their memberships, collaborator grants, sessions, inbox and
 * notifications are removed; todos assigned to them become unassigned.
 * Workspaces nobody else is in are deleted; in shared ones, if they were the
 * only owner, the most senior remaining member is promoted to owner.
 */
export async function deleteUser(db: Db, ctx: Ctx, id: string): Promise<void> {
  await assertAdmin(db, ctx);
  if (id === ctx.userId) throw BadRequest("You can't delete your own account from the admin page");
  const target = await loadUser(db, id);
  await assertNotLastAdmin(db, target);

  await db.transaction(async (txRaw) => {
    // services take Db; a transaction exposes the same query API
    const tx = txRaw as unknown as Db;
    await anonymize(tx, target);
  });
  logger.info({ actor: ctx.userId, target: id }, "admin deleted (anonymized) user");
}

async function anonymize(db: Db, u: UserRow): Promise<void> {
  const U = u.id;

  /* 1. decide what others can see — while U's memberships still exist */
  const othersInWorkspace = async (wsId: string) =>
    (
      await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, wsId), ne(workspaceMembers.userId, U)))
        .limit(1)
    ).length > 0;

  const projectSeenByOthers = new Map<string, boolean>();
  const isProjectShared = async (projectId: string): Promise<boolean> => {
    const hit = projectSeenByOthers.get(projectId);
    if (hit !== undefined) return hit;
    const [p] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    let shared = false;
    if (p) {
      shared =
        p.ownerId !== U ||
        (p.workspaceId != null && (await othersInWorkspace(p.workspaceId))) ||
        (
          await db
            .select({ id: projectMembers.id })
            .from(projectMembers)
            .where(and(eq(projectMembers.projectId, projectId), ne(projectMembers.userId, U)))
            .limit(1)
        ).length > 0;
    }
    projectSeenByOthers.set(projectId, shared);
    return shared;
  };

  const hasOtherCollaborator = async (
    table: typeof todoCollaborators | typeof eventCollaborators | typeof referenceCollaborators,
    itemCol: SQLiteColumn,
    itemId: string,
  ) =>
    (
      await db
        .select({ id: table.id })
        .from(table)
        .where(and(eq(itemCol, itemId), ne(table.userId, U)))
        .limit(1)
    ).length > 0;

  // todos: decide on top-level todos; subtasks go with their parent
  const myTodos = await db
    .select()
    .from(todos)
    .where(and(eq(todos.createdBy, U), isNull(todos.parentTodoId)));
  for (const t of myTodos) {
    const shared =
      (t.assigneeId != null && t.assigneeId !== U) ||
      (t.projectId != null && (await isProjectShared(t.projectId))) ||
      (await hasOtherCollaborator(todoCollaborators, todoCollaborators.todoId, t.id));
    if (!shared) await purgeTodoTree(db, t.id);
  }

  for (const e of await db.select().from(events).where(eq(events.createdBy, U))) {
    const shared =
      (e.projectId != null && (await isProjectShared(e.projectId))) ||
      (await hasOtherCollaborator(eventCollaborators, eventCollaborators.eventId, e.id));
    if (!shared) {
      await purgePolymorphicRefs(db, "event", e.id);
      await releaseAnchors(db, [e.id]);
      await db.delete(events).where(eq(events.id, e.id));
    }
  }

  for (const r of await db.select().from(references).where(eq(references.addedBy, U))) {
    const shared =
      (r.projectId != null && (await isProjectShared(r.projectId))) ||
      (await hasOtherCollaborator(referenceCollaborators, referenceCollaborators.referenceId, r.id));
    if (!shared) {
      await purgePolymorphicRefs(db, "reference", r.id);
      await db.delete(references).where(eq(references.id, r.id));
    }
  }

  for (const p of await db.select().from(projects).where(eq(projects.ownerId, U))) {
    if (!(await isProjectShared(p.id))) {
      await purgePolymorphicRefs(db, "project", p.id);
      await db.delete(projects).where(eq(projects.id, p.id)); // any leftover items → SET NULL
    }
  }

  // personal tags are U's alone; workspace tags are shared vocabulary and stay
  await db.delete(tags).where(and(eq(tags.ownerId, U), isNull(tags.workspaceId)));

  // workspaces: delete the empty ones, keep an owner in the shared ones
  const myWs = await db
    .select({ wsId: workspaceMembers.workspaceId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, U));
  for (const { wsId, role } of myWs) {
    const others = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, wsId), ne(workspaceMembers.userId, U)))
      .orderBy(asc(workspaceMembers.createdAt));
    if (others.length === 0) {
      await db.delete(workspaces).where(eq(workspaces.id, wsId)); // members cascade; items SET NULL
      continue;
    }
    if (role === "owner" && !others.some((m) => m.role === "owner")) {
      const rank = { owner: 0, admin: 1, editor: 2, viewer: 3 } as const;
      const heir = [...others].sort((a, b) => rank[a.role] - rank[b.role])[0]!;
      await db.update(workspaceMembers).set({ role: "owner" }).where(eq(workspaceMembers.id, heir.id));
    }
  }

  /* 2. remove U's footprint */
  await db.delete(sessions).where(eq(sessions.userId, U));
  // the day planner is personal — nothing in it is shared (ADR-0006)
  await db.delete(timeBlocks).where(eq(timeBlocks.userId, U));
  await db.delete(dayNotes).where(eq(dayNotes.userId, U));
  await db.delete(categories).where(eq(categories.userId, U));
  await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, U));
  await db.delete(projectMembers).where(eq(projectMembers.userId, U));
  await db.delete(todoCollaborators).where(eq(todoCollaborators.userId, U));
  await db.delete(eventCollaborators).where(eq(eventCollaborators.userId, U));
  await db.delete(referenceCollaborators).where(eq(referenceCollaborators.userId, U));
  await db.delete(eventAttendees).where(eq(eventAttendees.userId, U));
  await db.delete(notifications).where(eq(notifications.userId, U));
  await db.delete(incomingItems).where(eq(incomingItems.forUserId, U));
  // mirrored events that survived step 1 (others can see them) become ordinary events first
  for (const a of await db.select({ id: integrationAccounts.id }).from(integrationAccounts).where(eq(integrationAccounts.userId, U))) {
    await keepMirrorsAsOwn(db, a.id);
  }
  await db.delete(integrationAccounts).where(eq(integrationAccounts.userId, U));
  await db.update(todos).set({ assigneeId: null }).where(eq(todos.assigneeId, U));

  /* 3. scrub the row itself — email stays unique but unusable, so the real address is free again */
  const now = clock.now();
  await db
    .update(users)
    .set({
      email: `deleted-${U}@deleted.invalid`,
      displayName: "Deleted user",
      avatarUrl: null,
      passwordHash: null,
      googleId: null,
      role: "member",
      timezone: "UTC",
      disabledAt: u.disabledAt ?? now,
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, U));
}
