import { z } from "zod";
import { entityType, epochMs, hexColor, id } from "./common.js";

export const tag = z.object({
  id,
  workspaceId: id.nullable(),
  ownerId: id,
  name: z.string(),
  color: hexColor.nullable(),
  createdAt: epochMs,
});
export type Tag = z.infer<typeof tag>;

export const createTag = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  color: hexColor.nullish(),
  workspaceId: id.nullish(),
});
export type CreateTag = z.infer<typeof createTag>;

export const applyTag = z.object({
  tagId: id,
  entityType: entityType.exclude(["incoming_item"]),
  entityId: id,
});
export type ApplyTag = z.infer<typeof applyTag>;
