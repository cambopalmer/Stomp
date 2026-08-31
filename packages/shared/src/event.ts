import { z } from "zod";
import { epochMs, eventStatus, id } from "./common.js";

export const calendarEvent = z.object({
  id,
  workspaceId: id.nullable(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  startsAt: epochMs,
  endsAt: epochMs,
  allDay: z.boolean(),
  timezone: z.string(),
  rrule: z.string().nullable(),
  projectId: id.nullable(),
  createdBy: id,
  status: eventStatus,
  externalProvider: z.enum(["google", "outlook", "ics"]).nullable(),
  externalId: z.string().nullable(),
  createdAt: epochMs,
  updatedAt: epochMs,
});
export type CalendarEvent = z.infer<typeof calendarEvent>;

export const createEvent = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  description: z.string().max(20_000).nullish(),
  location: z.string().max(500).nullish(),
  startsAt: epochMs,
  endsAt: epochMs,
  allDay: z.boolean().optional(),
  timezone: z.string().min(1).max(64).optional(),
  projectId: id.nullish(),
  workspaceId: id.nullish(),
}).refine((v) => v.endsAt >= v.startsAt, {
  message: "End must be at or after start",
  path: ["endsAt"],
});
export type CreateEvent = z.infer<typeof createEvent>;

export const updateEvent = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(20_000).nullish(),
  location: z.string().max(500).nullish(),
  startsAt: epochMs.optional(),
  endsAt: epochMs.optional(),
  allDay: z.boolean().optional(),
  timezone: z.string().min(1).max(64).optional(),
  projectId: id.nullish(),
  status: eventStatus.optional(),
}).refine((v) => Object.keys(v).length > 0, "No fields to update");
export type UpdateEvent = z.infer<typeof updateEvent>;
