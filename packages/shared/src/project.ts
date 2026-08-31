import { z } from "zod";
import { epochMs, hexColor, id, projectRole, projectStatus } from "./common.js";

export const project = z.object({
  id,
  workspaceId: id.nullable(),
  ownerId: id,
  name: z.string(),
  description: z.string().nullable(),
  color: hexColor.nullable(),
  status: projectStatus,
  createdAt: epochMs,
  updatedAt: epochMs,
});
export type Project = z.infer<typeof project>;

export const createProject = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().max(5_000).nullish(),
  color: hexColor.nullish(),
  workspaceId: id.nullish(),
});
export type CreateProject = z.infer<typeof createProject>;

export const updateProject = createProject.partial()
  .extend({ status: projectStatus.optional() })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");
export type UpdateProject = z.infer<typeof updateProject>;

export const projectMember = z.object({
  id,
  projectId: id,
  userId: id,
  role: projectRole,
  addedBy: id,
  createdAt: epochMs,
});
export type ProjectMember = z.infer<typeof projectMember>;

export const addProjectMember = z.object({
  userId: id,
  role: projectRole.default("editor"),
});
export type AddProjectMember = z.infer<typeof addProjectMember>;

/** Project list rows carry rollup counts for cards. */
export const projectWithCounts = project.extend({
  counts: z.object({
    todosOpen: z.number().int(),
    todosDone: z.number().int(),
    events: z.number().int(),
    references: z.number().int(),
    incoming: z.number().int(),
  }),
});
export type ProjectWithCounts = z.infer<typeof projectWithCounts>;
