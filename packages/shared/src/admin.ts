import { z } from "zod";
import { credentials } from "./auth.js";
import { epochMs, id } from "./common.js";

export const userRole = z.enum(["member", "admin"]);
export type UserRole = z.infer<typeof userRole>;

/**
 * A user as the admin page sees them. Account metadata only — admins manage
 * accounts, they never see anyone's todos / events / references.
 */
export const adminUser = z.object({
  id,
  email: z.string(),
  displayName: z.string(),
  role: userRole,
  hasPassword: z.boolean(),
  googleLinked: z.boolean(),
  createdAt: epochMs,
  lastLoginAt: epochMs.nullable(),
  disabledAt: epochMs.nullable(),
  deletedAt: epochMs.nullable(),
});
export type AdminUser = z.infer<typeof adminUser>;

export const adminUpdateUser = z
  .object({ role: userRole.optional(), disabled: z.boolean().optional() })
  .refine((v) => v.role !== undefined || v.disabled !== undefined, "Nothing to change");
export type AdminUpdateUser = z.infer<typeof adminUpdateUser>;

const toolLink = z.object({ label: z.string(), url: z.string(), hint: z.string().optional() });

/** Operator links for the admin page (backlog: "Admin panel: tools & links"). */
export const adminTools = z.object({
  /** Drizzle Studio — a local dev tool; null in production */
  dataBrowser: toolLink.nullable(),
  architectureMap: toolLink,
  googleCloud: z.object({
    /** OAuth app configured on this server */
    configured: z.boolean(),
    /** null until GOOGLE_CLOUD_PROJECT is set */
    projectId: z.string().nullable(),
    links: z.array(toolLink),
  }),
});
export type AdminTools = z.infer<typeof adminTools>;

/** Admin sets a new password (no email infra yet — hand it over out of band). */
export const adminResetPassword = credentials.pick({ password: true });
export type AdminResetPassword = z.infer<typeof adminResetPassword>;
