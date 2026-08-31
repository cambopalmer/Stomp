import type { AddWorkspaceMember, CreateWorkspace, Workspace } from "@stomp/shared";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { users, workspaceMembers, workspaces } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { BadRequest, Forbidden, NotFound } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { type Ctx, workspaceIds } from "./access.js";
import { logActivity } from "./activity.js";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "workspace";

export async function listWorkspaces(db: Db, ctx: Ctx): Promise<Workspace[]> {
  const ids = await workspaceIds(db, ctx.userId);
  if (ids.length === 0) return [];
  return db.select().from(workspaces).where(inArray(workspaces.id, ids)).orderBy(workspaces.name);
}

export async function createWorkspace(db: Db, ctx: Ctx, input: CreateWorkspace): Promise<Workspace> {
  const ts = clock.now();
  let slug = slugify(input.name);
  const [clash] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  if (clash) slug = `${slug}-${newId().slice(0, 6)}`;

  const row = {
    id: newId(),
    name: input.name,
    slug,
    description: input.description ?? null,
    color: input.color ?? null,
    createdBy: ctx.userId,
    status: "active" as const,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(workspaces).values(row);
  await db.insert(workspaceMembers).values({
    id: newId(),
    workspaceId: row.id,
    userId: ctx.userId,
    role: "owner",
    addedBy: ctx.userId,
    createdAt: ts,
  });
  await logActivity(db, ctx.userId, "workspace", row.id, "created");
  return row;
}

async function assertOwnerOrAdmin(db: Db, ctx: Ctx, workspaceId: string) {
  const [m] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, ctx.userId)))
    .limit(1);
  if (!m) throw NotFound("Workspace");
  if (m.role !== "owner" && m.role !== "admin") throw Forbidden("Only owners/admins can manage members");
}

export async function addMember(db: Db, ctx: Ctx, workspaceId: string, input: AddWorkspaceMember) {
  await assertOwnerOrAdmin(db, ctx, workspaceId);
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!u) throw BadRequest("No such user");
  const row = {
    id: newId(),
    workspaceId,
    userId: input.userId,
    role: input.role,
    addedBy: ctx.userId,
    createdAt: clock.now(),
  };
  await db.insert(workspaceMembers).values(row).onConflictDoNothing();
  await logActivity(db, ctx.userId, "workspace", workspaceId, "shared");
  return row;
}
