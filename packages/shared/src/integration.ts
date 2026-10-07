import { z } from "zod";
import { epochMs, id } from "./common.js";

/** What the user connects. One grant each (ADR-0005). */
export const integrationProduct = z.enum(["gmail", "calendar"]);
export type IntegrationProduct = z.infer<typeof integrationProduct>;

export const integrationProvider = z.enum(["gmail", "google_calendar", "outlook", "imap"]);
export type IntegrationProvider = z.infer<typeof integrationProvider>;

export const googleCalendarChoice = z.object({
  id: z.string(),
  summary: z.string(),
  primary: z.boolean(),
  selected: z.boolean(),
  color: z.string().nullable(),
});
export type GoogleCalendarChoice = z.infer<typeof googleCalendarChoice>;

/** A connected account as the client sees it — never any token material. */
export const integrationAccount = z.object({
  id,
  provider: integrationProvider,
  email: z.string(),
  status: z.enum(["connected", "needs_reauth", "disconnected"]),
  lastSyncAt: epochMs.nullable(),
  lastError: z.string().nullable(),
  createdAt: epochMs,
  /** google_calendar only */
  calendars: z.array(googleCalendarChoice).optional(),
  /** google_calendar only: events currently mirrored from this connection */
  mirroredEvents: z.number().int().optional(),
});
export type IntegrationAccount = z.infer<typeof integrationAccount>;

export const integrationsResponse = z.object({
  /** false until the server has Google credentials + INTEGRATION_ENC_KEY */
  configured: z.boolean(),
  accounts: z.array(integrationAccount),
});
export type IntegrationsResponse = z.infer<typeof integrationsResponse>;

export const selectCalendarsInput = z.object({ calendarIds: z.array(z.string()).max(100) });
export type SelectCalendarsInput = z.infer<typeof selectCalendarsInput>;

export const disconnectResult = z.object({ kept: z.number().int(), removed: z.number().int() });
export type DisconnectResult = z.infer<typeof disconnectResult>;

export const syncLogEntry = z.object({
  id,
  entityType: z.enum(["email", "event"]),
  summary: z.string(),
  error: z.string().nullable(),
  startedAt: epochMs,
  finishedAt: epochMs.nullable(),
});
export type SyncLogEntry = z.infer<typeof syncLogEntry>;
