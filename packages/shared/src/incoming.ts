import { z } from "zod";
import { epochMs, id, incomingKind, incomingStatus } from "./common.js";

export const incomingItem = z.object({
  id,
  workspaceId: id.nullable(),
  title: z.string(),
  body: z.string().nullable(),
  kind: incomingKind,
  status: incomingStatus,
  forUserId: id,
  createdBy: id.nullable(),
  projectId: id.nullable(),
  sourceRef: z.string().nullable(),
  sourceMeta: z.string().nullable(),
  linkedEntityType: z.enum(["todo", "event"]).nullable(),
  linkedEntityId: id.nullable(),
  createdAt: epochMs,
  triagedAt: epochMs.nullable(),
});
export type IncomingItem = z.infer<typeof incomingItem>;

/** Quick capture from the banner. */
export const createIncoming = z.object({
  title: z.string().trim().min(1, "Say something").max(500),
  body: z.string().max(20_000).nullish(),
  projectId: id.nullish(),
  workspaceId: id.nullish(),
});
export type CreateIncoming = z.infer<typeof createIncoming>;

/** Triage an item into a todo or an event. */
export const triageIncoming = z.discriminatedUnion("target", [
  z.object({
    target: z.literal("todo"),
    title: z.string().trim().min(1).max(500),
    notes: z.string().max(20_000).nullish(),
    dueAt: epochMs.nullish(),
    scheduledFor: epochMs.nullish(),
    projectId: id.nullish(),
  }),
  z.object({
    target: z.literal("event"),
    title: z.string().trim().min(1).max(500),
    startsAt: epochMs,
    endsAt: epochMs,
    allDay: z.boolean().optional(),
    projectId: id.nullish(),
  }),
  z.object({ target: z.literal("dismiss") }),
]);
export type TriageIncoming = z.infer<typeof triageIncoming>;
