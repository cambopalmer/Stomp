import { z } from "zod";
import { epochMs, id, priority, todoSource, todoStatus } from "./common.js";

export const todo = z.object({
  id,
  workspaceId: id.nullable(),
  title: z.string(),
  notes: z.string().nullable(),
  status: todoStatus,
  priority,
  dueAt: epochMs.nullable(),
  scheduledFor: epochMs.nullable(),
  completedAt: epochMs.nullable(),
  projectId: id.nullable(),
  parentTodoId: id.nullable(),
  createdBy: id,
  assigneeId: id.nullable(),
  source: todoSource,
  sortOrder: z.number().int(),
  createdAt: epochMs,
  updatedAt: epochMs,
});
export type Todo = z.infer<typeof todo>;

export const createTodo = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  notes: z.string().max(20_000).nullish(),
  status: todoStatus.optional(),
  priority: priority.optional(),
  dueAt: epochMs.nullish(),
  scheduledFor: epochMs.nullish(),
  projectId: id.nullish(),
  parentTodoId: id.nullish(),
  assigneeId: id.nullish(),
  workspaceId: id.nullish(),
});
export type CreateTodo = z.infer<typeof createTodo>;

/** All fields optional; at least one required. */
export const updateTodo = createTodo.partial().extend({
  completedAt: epochMs.nullish(),
  sortOrder: z.number().int().optional(),
}).refine((v) => Object.keys(v).length > 0, "No fields to update");
export type UpdateTodo = z.infer<typeof updateTodo>;

export const todoWithChildren = todo.extend({
  children: z.array(todo).default([]),
});
export type TodoWithChildren = z.infer<typeof todoWithChildren>;
