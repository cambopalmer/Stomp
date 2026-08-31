import { z } from "zod";

/** Text primary keys (uuid v4). Generated in the API repository layer. */
export const id = z.string().uuid();

/** Epoch milliseconds, UTC. How every timestamp crosses the wire. */
export const epochMs = z.number().int().nonnegative();

/** ISO date (no time) — used for `scheduled_for` day pickers on the client. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const todoStatus = z.enum(["open", "in_progress", "blocked", "done", "cancelled"]);
export type TodoStatus = z.infer<typeof todoStatus>;

export const priority = z.enum(["none", "low", "medium", "high", "urgent"]);
export type Priority = z.infer<typeof priority>;

export const todoSource = z.enum(["manual", "inbox", "email", "import"]);

export const eventStatus = z.enum(["confirmed", "tentative", "cancelled"]);

export const referenceStatus = z.enum(["to_learn", "learning", "learned", "archived"]);
export type ReferenceStatus = z.infer<typeof referenceStatus>;

export const incomingKind = z.enum(["capture", "email", "shared_task", "shared_event", "system"]);
export const incomingStatus = z.enum(["unread", "triaged", "dismissed"]);

export const projectStatus = z.enum(["active", "archived"]);
export const workspaceRole = z.enum(["owner", "admin", "editor", "viewer"]);
export const projectRole = z.enum(["owner", "editor", "viewer"]);

export const entityType = z.enum(["todo", "event", "reference", "project", "incoming_item"]);
export type EntityType = z.infer<typeof entityType>;

export const hexColor = z.string().regex(/^#([0-9a-fA-F]{6})$/, "expected #rrggbb");

/** Standard list envelope. */
export const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListQuery = z.infer<typeof listQuery>;

export const idParam = z.object({ id });

/** Fields present on every persisted row when it comes back to the client. */
export const auditFields = z.object({
  id,
  createdAt: epochMs,
  updatedAt: epochMs,
});
