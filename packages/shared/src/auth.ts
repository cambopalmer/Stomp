import { z } from "zod";
import { epochMs, id } from "./common.js";

export const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "At least 8 characters").max(200),
});
export type Credentials = z.infer<typeof credentials>;

export const signupInput = credentials.extend({
  displayName: z.string().trim().min(1, "Required").max(120),
});
export type SignupInput = z.infer<typeof signupInput>;

/** The current user, as returned by /auth/me and /auth/login. */
export const authUser = z.object({
  id,
  email: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  timezone: z.string(),
  hasPassword: z.boolean(),
  googleLinked: z.boolean(),
  createdAt: epochMs,
});
export type AuthUser = z.infer<typeof authUser>;

export const meResponse = z.object({
  user: authUser.nullable(),
  /** whether the "Sign in with Google" button should be shown */
  googleEnabled: z.boolean(),
  signupOpen: z.boolean(),
});
export type MeResponse = z.infer<typeof meResponse>;
