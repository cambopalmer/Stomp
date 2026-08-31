import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { projectMembers, projects, workspaceMembers } from "../db/schema.js";

export interface Ctx {
  userId: string;
}

/** Workspace ids the user is a member of. */
export async function workspaceIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId));
  return rows.map((r) => r.id);
}

/**
 * Projects the user can access (ADR-0003):
 *  - owns it
 *  - is a project_member
 *  - it belongs to a workspace they're a member of
 */
export async function accessibleProjectIds(db: Db, userId: string): Promise<string[]> {
  const wsIds = await workspaceIds(db, userId);
  const rows = await db
    .selectDistinct({ id: projects.id })
    .from(projects)
    .leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(
      or(
        eq(projects.ownerId, userId),
        eq(projectMembers.userId, userId),
        wsIds.length ? inArray(projects.workspaceId, wsIds) : sql`0`,
      ),
    );
  return rows.map((r) => r.id);
}

export type ProjectAccess = { canView: boolean; canEdit: boolean };

/** Effective access to one project = stronger of workspace role and project role. */
export async function projectAccess(db: Db, userId: string, projectId: string): Promise<ProjectAccess> {
  const [proj] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!proj) return { canView: false, canEdit: false };
  if (proj.ownerId === userId) return { canView: true, canEdit: true };

  const roles: string[] = [];
  const [pm] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  if (pm) roles.push(pm.role);

  if (proj.workspaceId) {
    const [wm] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, proj.workspaceId), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (wm) roles.push(wm.role);
  }

  if (roles.length === 0) return { canView: false, canEdit: false };
  const canEdit = roles.some((r) => r === "owner" || r === "admin" || r === "editor");
  return { canView: true, canEdit };
}
