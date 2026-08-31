import { z } from "zod";
import { epochMs, id, referenceStatus } from "./common.js";

export const reference = z.object({
  id,
  workspaceId: id.nullable(),
  title: z.string(),
  url: z.string(),
  description: z.string().nullable(),
  status: referenceStatus,
  favorite: z.boolean(),
  projectId: id.nullable(),
  addedBy: id,
  lastOpenedAt: epochMs.nullable(),
  createdAt: epochMs,
  updatedAt: epochMs,
});
export type Reference = z.infer<typeof reference>;

export const createReference = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  url: z.string().url("Must be a valid URL").max(2000),
  description: z.string().max(20_000).nullish(),
  status: referenceStatus.optional(),
  favorite: z.boolean().optional(),
  projectId: id.nullish(),
  workspaceId: id.nullish(),
});
export type CreateReference = z.infer<typeof createReference>;

export const updateReference = createReference.partial()
  .extend({ lastOpenedAt: epochMs.nullish() })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");
export type UpdateReference = z.infer<typeof updateReference>;
