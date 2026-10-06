import { config } from "../config.js";
import { AppError } from "./errors.js";

/**
 * Minimal Google OAuth + REST client over global fetch (stubbed in tests).
 * Sign-in uses @fastify/oauth2 (plugins/googleOAuth.ts); this is the separate
 * integrations grant: offline access, one product scope at a time (ADR-0005).
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const SCOPES = {
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
  calendar: "https://www.googleapis.com/auth/calendar.readonly",
} as const;

export const integrationsCallbackUri = () => `${config.PUBLIC_BASE_URL}/api/integrations/google/callback`;

export function buildAuthUrl(scope: string, state: string, loginHint?: string): string {
  const q = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID!,
    redirect_uri: integrationsCallbackUri(),
    response_type: "code",
    scope: `openid email ${scope}`,
    access_type: "offline", // we need a refresh token for background sync
    prompt: "consent", // …and Google only re-issues one on explicit consent
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) q.set("login_hint", loginHint);
  return `${AUTH_URL}?${q}`;
}

export interface TokenSet {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

/** Google said the grant is dead (revoked, expired in Testing mode, password change…). */
export class GrantRevoked extends Error {}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID!,
      client_secret: config.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as TokenSet & { error?: string };
  if (!res.ok) {
    if (json.error === "invalid_grant") throw new GrantRevoked("Google revoked or expired this connection");
    throw new AppError(502, "google_error", `Google token request failed (${json.error ?? res.status})`);
  }
  return json;
}

export const exchangeCode = (code: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: integrationsCallbackUri() });

export const refreshAccessToken = (refreshToken: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

/** Best effort — a failed revoke shouldn't block disconnecting locally. */
export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

export async function fetchUserEmail(accessToken: string): Promise<string> {
  const info = await googleGet<{ email?: string; email_verified?: boolean }>(USERINFO_URL, accessToken);
  if (!info.email || info.email_verified === false) throw new AppError(400, "google_error", "Google account has no verified email");
  return info.email.toLowerCase();
}

/** GET a Google REST endpoint with a bearer token. 401 → GrantRevoked so callers can refresh / flag re-auth. */
export async function googleGet<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) throw new GrantRevoked("Google rejected the access token");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    throw new GoogleApiError(res.status, body.error?.message ?? `Google API error ${res.status}`, body.error?.status);
  }
  return (await res.json()) as T;
}

export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly reason?: string,
  ) {
    super(message);
  }
}
