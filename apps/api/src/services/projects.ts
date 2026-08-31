import type { CreateProject, Project, ProjectWithCounts, UpdateProject } from "@stomp/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { events, incomingItems, projectMembers, projects, references, todos } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { BadRequest, Forbidden, NotFound } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { accessibleProjectIds, type Ctx, projectAccess, workspaceIds } from "./access.js";
import { logActivity } from "./activity.js";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "project";

export async function listProjects(db: Db, ctx: Ctx): Promise<ProjectWithCounts[]> {
  const ids = await accessibleProjectIds(db, ctx.userId);
  if (ids.length === 0) return [];
  const rows = await db.select().from(projects).where(inArray(projects.id, ids)).orderBy(projects.name);

  const count = async (table: typeof todos | typeof events | typeof references | typeof incomingItems, extra?: unknown) => {
    const r = await db
      .select({ projectId: table.projectId, n: sql<number>`count(*)` })
      .from(table)
      .where(and(inArray(table.projectId, ids), extra as never))
      .groupBy(table.projectId);
    return new Map(r.map((x) => [x.projectId, Number(x.n)]));
  };

  const [openT, doneT, ev, ref, inc] = await Promise.all([
    count(todos, and(eq(todos.status, "open"))),
    count(todos, eq(todos.status, "done")),
    count(events, undefined),
    count(references, undefined),
    count(incomingItems, eq(incomingItems.status, "unread")),
  ]);

  return rows.map((p) => ({
    ...p,
    counts: {
      todosOpen: openT.get(p.id) ?? 0,
      todosDone: doneT.get(p.id) ?? 0,
      events: ev.get(p.id) ?? 0,
      references: ref.get(p.id) ?? 0,
      incoming: inc.get(p.id) ?? 0,
    },
  }));
}

export async function getProject(db: Db, ctx: Ctx, id: string): Promise<Project> {
  const access = await projectAccess(db, ctx.userId, id);
  if (!access.canView) throw NotFound("Project");
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!row) throw NotFound("Project");
  return row;
}

export async function createProject(db: Db, ctx: Ctx, input: CreateProject): Promise<Project> {
  if (input.workspaceId) {
    const wsIds = await workspaceIds(db, ctx.userId);
    if (!wsIds.includes(input.workspaceId)) throw Forbidden("You're not a member of that workspace");
  }
  const ts = clock.now();
  const row = {
    id: newId(),
    workspaceId: input.workspaceId ?? null,
    ownerId: ctx.userId,
    name: input.name,
    description: input.description ?? null,
    color: input.color ?? null,
    status: "active" as const,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(projects).values(row);
  await db.insert(projectMembers).values({
    id: newId(),
    projectId: row.id,
    userId: ctx.userId,
    role: "owner",
    addedBy: ctx.userId,
    createdAt: ts,
  });
  await logActivity(db, ctx.userId, "project", row.id, "created");
  return row;
}

export async function updateProject(db: Db, ctx: Ctx, id: string, input: UpdateProject): Promise<Project> {
  const current = await getProject(db, ctx, id);
  const access = await projectAccess(db, ctx.userId, id);
  if (!access.canEdit) throw Forbidden("You can't edit this project");
  const patch: Partial<Project> = { updatedAt: clock.now() };
  for (const f of ["name", "description", "color", "status", "workspaceId"] as const) {
    if (input[f] !== undefined) (patch as Record<string, unknown>)[f] = input[f];
  }
  await db.update(projects).set(patch).where(eq(projects.id, id));
  await logActivity(db, ctx.userId, "project", id, "updated");
  return { ...current, ...patch } as Project;
}

export async function deleteProject(db: Db, ctx: Ctx, id: string): Promise<void> {
  const current = await getProject(db, ctx, id);
  if (current.ownerId !== ctx.userId) throw Forbidden("Only the owner can delete a project");
  await db.delete(projects).where(eq(projects.id, id));
  await logActivity(db, ctx.userId, "project", id, "deleted");
}

export { slugify };
