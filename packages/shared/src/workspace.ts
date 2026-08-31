import { z } from "zod";
import { epochMs, hexColor, id, workspaceRole } from "./common.js";

export const workspace = z.object({
  id,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  color: hexColor.nullable(),
  createdBy: id,
  status: z.enum(["active", "archived"]),
  createdAt: epochMs,
  updatedAt: epochMs,
});
export type Workspace = z.infer<typeof workspace>;

export const createWorkspace = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().max(5_000).nullish(),
  color: hexColor.nullish(),
});
export type CreateWorkspace = z.infer<typeof createWorkspace>;

export const workspaceMember = z.object({
  id,
  workspaceId: id,
  userId: id,
  role: workspaceRole,
  addedBy: id,
  createdAt: epochMs,
});
export type WorkspaceMember = z.infer<typeof workspaceMember>;

/** Member row joined with the user, for the members list UI. */
export const workspaceMemberView = z.object({
  userId: id,
  displayName: z.string(),
  email: z.string(),
  role: workspaceRole,
});
export type WorkspaceMemberView = z.infer<typeof workspaceMemberView>;

export const addWorkspaceMember = z.object({
  email: z.string().email(),
  role: workspaceRole.default("editor"),
});
export type AddWorkspaceMember = z.infer<typeof addWorkspaceMember>;
