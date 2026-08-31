import { z } from "zod";
import { id } from "./common.js";

export const collaboratorRole = z.enum(["editor", "viewer"]);

export const collaboratorView = z.object({
  userId: id,
  displayName: z.string(),
  email: z.string(),
  role: collaboratorRole,
});
export type CollaboratorView = z.infer<typeof collaboratorView>;

export const shareInput = z.object({
  email: z.string().email(),
  role: collaboratorRole.default("viewer"),
});
export type ShareInput = z.infer<typeof shareInput>;
