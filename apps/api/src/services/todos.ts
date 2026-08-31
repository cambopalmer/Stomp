import type { CreateTodo, Todo, UpdateTodo } from "@stomp/shared";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { todoCollaborators, todos } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { BadRequest, Forbidden, NotFound } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { accessibleProjectIds, type Ctx, projectAccess } from "./access.js";
import { logActivity } from "./activity.js";

function visibleFilter(userId: string, projIds: string[], collabIds: string[]) {
  return or(
    eq(todos.createdBy, userId),
    eq(todos.assigneeId, userId),
    projIds.length ? inArray(todos.projectId, projIds) : sql`0`,
    collabIds.length ? inArray(todos.id, collabIds) : sql`0`,
  );
}

async function collaboratingTodoIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: todoCollaborators.todoId })
    .from(todoCollaborators)
    .where(eq(todoCollaborators.userId, userId));
  return rows.map((r) => r.id);
}

export interface ListTodoFilter {
  status?: string;
  projectId?: string;
  parentTodoId?: string | null;
}

export async function listTodos(db: Db, ctx: Ctx, filter: ListTodoFilter = {}): Promise<Todo[]> {
  const [projIds, collabIds] = await Promise.all([
    accessibleProjectIds(db, ctx.userId),
    collaboratingTodoIds(db, ctx.userId),
  ]);
  const conds = [visibleFilter(ctx.userId, projIds, collabIds)];
  if (filter.status) conds.push(eq(todos.status, filter.status as Todo["status"]));
  if (filter.projectId) conds.push(eq(todos.projectId, filter.projectId));
  if (filter.parentTodoId === null) conds.push(isNull(todos.parentTodoId));
  else if (filter.parentTodoId) conds.push(eq(todos.parentTodoId, filter.parentTodoId));

  return db
    .select()
    .from(todos)
    .where(and(...conds))
    .orderBy(todos.sortOrder, desc(todos.createdAt));
}

async function loadVisible(db: Db, ctx: Ctx, id: string): Promise<Todo> {
  const [projIds, collabIds] = await Promise.all([
    accessibleProjectIds(db, ctx.userId),
    collaboratingTodoIds(db, ctx.userId),
  ]);
  const [row] = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, id), visibleFilter(ctx.userId, projIds, collabIds)))
    .limit(1);
  if (!row) throw NotFound("Todo");
  return row;
}

export async function getTodo(db: Db, ctx: Ctx, id: string) {
  const todo = await loadVisible(db, ctx, id);
  const children = await db
    .select()
    .from(todos)
    .where(eq(todos.parentTodoId, id))
    .orderBy(todos.sortOrder, desc(todos.createdAt));
  return { ...todo, children };
}

async function assertCanUseProject(db: Db, ctx: Ctx, projectId: string | null | undefined) {
  if (!projectId) return;
  const access = await projectAccess(db, ctx.userId, projectId);
  if (!access.canEdit) throw Forbidden("You can't add items to that project");
}

export async function createTodo(db: Db, ctx: Ctx, input: CreateTodo): Promise<Todo> {
  let { workspaceId, projectId } = input;

  if (input.parentTodoId) {
    const parent = await loadVisible(db, ctx, input.parentTodoId);
    if (parent.parentTodoId) throw BadRequest("Subtasks can't have their own subtasks");
    // Subtasks inherit the parent's workspace + project (ADR-0003).
    workspaceId = parent.workspaceId;
    projectId = parent.projectId;
  } else {
    await assertCanUseProject(db, ctx, projectId);
  }

  const ts = clock.now();
  const row = {
    id: newId(),
    workspaceId: workspaceId ?? null,
    title: input.title,
    notes: input.notes ?? null,
    status: input.status ?? ("open" as const),
    priority: input.priority ?? ("none" as const),
    dueAt: input.dueAt ?? null,
    scheduledFor: input.scheduledFor ?? null,
    completedAt: null,
    projectId: projectId ?? null,
    parentTodoId: input.parentTodoId ?? null,
    createdBy: ctx.userId,
    assigneeId: input.assigneeId ?? null,
    source: "manual" as const,
    sortOrder: 0,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(todos).values(row);
  await logActivity(db, ctx.userId, "todo", row.id, "created");
  return row;
}

export async function updateTodo(db: Db, ctx: Ctx, id: string, input: UpdateTodo): Promise<Todo> {
  const current = await loadVisible(db, ctx, id);
  await assertCanEdit(db, ctx, current);

  if (input.projectId !== undefined && !current.parentTodoId) {
    await assertCanUseProject(db, ctx, input.projectId);
  }

  const patch: Partial<Todo> = { updatedAt: clock.now() };
  const fields: (keyof UpdateTodo)[] = [
    "title", "notes", "status", "priority", "dueAt", "scheduledFor",
    "assigneeId", "sortOrder", "completedAt",
  ];
  for (const f of fields) if (input[f] !== undefined) (patch as Record<string, unknown>)[f] = input[f];
  if (input.projectId !== undefined && !current.parentTodoId) patch.projectId = input.projectId ?? null;
  if (input.workspaceId !== undefined && !current.parentTodoId) patch.workspaceId = input.workspaceId ?? null;

  // Auto-manage completedAt when status flips to/from done.
  if (input.status === "done" && current.status !== "done") patch.completedAt = clock.now();
  if (input.status && input.status !== "done" && current.status === "done") patch.completedAt = null;

  await db.update(todos).set(patch).where(eq(todos.id, id));

  // Cascade workspace/project to subtasks if this is a parent.
  if ((patch.projectId !== undefined || patch.workspaceId !== undefined) && !current.parentTodoId) {
    await db
      .update(todos)
      .set({
        projectId: patch.projectId ?? current.projectId,
        workspaceId: patch.workspaceId ?? current.workspaceId,
        updatedAt: clock.now(),
      })
      .where(eq(todos.parentTodoId, id));
  }

  await logActivity(db, ctx.userId, "todo", id, input.status === "done" ? "completed" : "updated");
  return { ...current, ...patch } as Todo;
}

export async function deleteTodo(db: Db, ctx: Ctx, id: string): Promise<void> {
  const current = await loadVisible(db, ctx, id);
  await assertCanEdit(db, ctx, current);
  await db.delete(todos).where(eq(todos.id, id)); // subtasks cascade via FK
  await logActivity(db, ctx.userId, "todo", id, "deleted");
}

async function assertCanEdit(db: Db, ctx: Ctx, todo: Todo) {
  if (todo.createdBy === ctx.userId || todo.assigneeId === ctx.userId) return;
  if (todo.projectId) {
    const access = await projectAccess(db, ctx.userId, todo.projectId);
    if (access.canEdit) return;
  }
  const [collab] = await db
    .select({ role: todoCollaborators.role })
    .from(todoCollaborators)
    .where(and(eq(todoCollaborators.todoId, todo.id), eq(todoCollaborators.userId, ctx.userId)))
    .limit(1);
  if (collab?.role === "editor") return;
  throw Forbidden("You can't edit this todo");
}
