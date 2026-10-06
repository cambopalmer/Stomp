import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { integrationAccounts, users } from "../src/db/schema.js";
import { seed } from "../src/db/seed.js";
import { unseal } from "../src/lib/crypto.js";
import { SCOPES } from "../src/lib/google.js";
import * as integrations from "../src/services/integrations.js";

// AUTH_TEST_BYPASS: every request acts as the seeded owner.
let app: FastifyInstance;
let ownerId: string;

beforeAll(async () => {
  await seed();
  app = await buildApp();
  ownerId = (await db.select().from(users).where(eq(users.email, "owner@stomp.local")))[0]!.id;
});
afterAll(() => app.close());
afterEach(() => vi.unstubAllGlobals());

/** Fake Google: token endpoint, userinfo, revoke. Records every call. */
function fakeGoogle(opts: { scope?: string; tokenError?: string; email?: string; refresh?: boolean } = {}) {
  const calls: { url: string; body: string }[] = [];
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? String(init.body) : "" });
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        if (opts.tokenError) return json(400, { error: opts.tokenError });
        return json(200, {
          access_token: `at-${calls.length}`,
          expires_in: 3600,
          ...(opts.refresh === false ? {} : { refresh_token: "rt-secret" }),
          scope: opts.scope ?? `openid https://www.googleapis.com/auth/userinfo.email ${SCOPES.gmail}`,
        });
      }
      if (url.startsWith("https://openidconnect.googleapis.com/v1/userinfo")) {
        return json(200, { email: opts.email ?? "Cam@Gmail.com", email_verified: true });
      }
      if (url.startsWith("https://oauth2.googleapis.com/revoke")) return json(200, {});
      return json(404, { error: { message: `unexpected ${url}` } });
    }),
  );
  return calls;
}

const cookieFrom = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers["set-cookie"];
  return String(Array.isArray(raw) ? raw[0] : raw).split(";")[0]!;
};

async function startConnect(product = "gmail") {
  const r = await app.inject({ method: "GET", url: `/api/integrations/google/connect?product=${product}` });
  expect(r.statusCode).toBe(302);
  const url = new URL(r.headers.location as string);
  return { url, state: url.searchParams.get("state")!, cookie: cookieFrom(r) };
}

const callback = (q: string, cookie?: string) =>
  app.inject({
    method: "GET",
    url: `/api/integrations/google/callback?${q}`,
    headers: cookie ? { cookie } : {},
  });

describe("integrations: connect flow", () => {
  it("lists nothing yet and reports configured", async () => {
    const r = await app.inject({ method: "GET", url: "/api/integrations" });
    expect(r.json()).toEqual({ configured: true, accounts: [] });
  });

  it("connect redirects to Google asking for offline access to just that product", async () => {
    const { url, state, cookie } = await startConnect("calendar");
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")).toBe(`openid email ${SCOPES.calendar}`);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:8080/api/integrations/google/callback");
    expect(state.length).toBeGreaterThan(20);
    expect(cookie).toMatch(/^stomp_oauth_state=/);
  });

  it("callback stores the account with tokens encrypted at rest", async () => {
    fakeGoogle();
    const { state, cookie } = await startConnect("gmail");
    const r = await callback(`code=abc&state=${state}`, cookie);
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toBe("http://localhost:5173/settings?connected=gmail");

    const [row] = await db.select().from(integrationAccounts).where(eq(integrationAccounts.userId, ownerId));
    expect(row).toMatchObject({ provider: "gmail", email: "cam@gmail.com", status: "connected" });
    expect(row!.refreshToken).not.toContain("rt-secret");
    expect(row!.refreshToken).toMatch(/^v1\./);
    expect(unseal(row!.refreshToken!)).toBe("rt-secret");

    const list = (await app.inject({ method: "GET", url: "/api/integrations" })).json();
    expect(list.accounts).toHaveLength(1);
    expect(JSON.stringify(list)).not.toMatch(/rt-secret|at-\d|v1\./); // no token material leaves the API
  });

  it("reconnecting the same account updates it instead of duplicating", async () => {
    fakeGoogle({ refresh: false }); // Google omits refresh_token on re-consent sometimes
    const { state, cookie } = await startConnect("gmail");
    await callback(`code=again&state=${state}`, cookie);
    const rows = await db.select().from(integrationAccounts).where(eq(integrationAccounts.userId, ownerId));
    expect(rows).toHaveLength(1);
    expect(unseal(rows[0]!.refreshToken!)).toBe("rt-secret"); // old refresh token kept
  });

  it("rejects a missing or mismatched state (CSRF) without calling Google", async () => {
    const calls = fakeGoogle();
    const { state, cookie } = await startConnect("gmail");
    expect((await callback(`code=x&state=${state}`)).headers.location).toContain("error=state");
    expect((await callback(`code=x&state=forged`, cookie)).headers.location).toContain("error=state");
    expect(calls).toHaveLength(0);
  });

  it("explains when the user unticked the permission on Google's screen", async () => {
    fakeGoogle({ scope: "openid email" });
    const { state, cookie } = await startConnect("calendar");
    const loc = (await callback(`code=x&state=${state}`, cookie)).headers.location as string;
    expect(loc).toContain("error=connect");
    expect(decodeURIComponent(loc.replace(/\+/g, " "))).toContain("Calendar access wasn't granted");
  });

  it("user cancelling at Google comes back as 'denied'", async () => {
    const { state, cookie } = await startConnect("gmail");
    expect((await callback(`error=access_denied&state=${state}`, cookie)).headers.location).toContain("error=denied");
  });
});

describe("integrations: tokens + disconnect", () => {
  const row = async () =>
    (await db.select().from(integrationAccounts).where(eq(integrationAccounts.userId, ownerId)))[0]!;

  it("refreshes an expiring access token", async () => {
    const calls = fakeGoogle();
    await db.update(integrationAccounts).set({ tokenExpiresAt: 0 }).where(eq(integrationAccounts.userId, ownerId));
    const token = await integrations.accessTokenFor(db, await row());
    expect(token).toMatch(/^at-/);
    expect(calls[0]!.body).toContain("grant_type=refresh_token");
    expect((await row()).tokenExpiresAt).toBeGreaterThan(Date.now());
  });

  it("a revoked grant flips the account to needs_reauth", async () => {
    fakeGoogle({ tokenError: "invalid_grant" });
    await db.update(integrationAccounts).set({ tokenExpiresAt: 0 }).where(eq(integrationAccounts.userId, ownerId));
    await expect(integrations.accessTokenFor(db, await row())).rejects.toThrow(/revoked or expired/);
    expect((await row()).status).toBe("needs_reauth");
  });

  it("other users can't see or disconnect it", async () => {
    const id = (await row()).id;
    const sam = (await db.select().from(users).where(eq(users.email, "sam@stomp.local")))[0]!;
    expect((await integrations.listAccounts(db, { userId: sam.id })).accounts).toEqual([]);
    await expect(integrations.disconnect(db, { userId: sam.id }, id)).rejects.toThrow(/not found/);
  });

  it("disconnect revokes at Google and deletes the row", async () => {
    const calls = fakeGoogle();
    const id = (await row()).id;
    expect((await app.inject({ method: "DELETE", url: `/api/integrations/${id}` })).statusCode).toBe(204);
    expect(calls.some((c) => c.url.startsWith("https://oauth2.googleapis.com/revoke") && c.body.includes("rt-secret"))).toBe(true);
    expect(await db.select().from(integrationAccounts).where(eq(integrationAccounts.userId, ownerId))).toEqual([]);
  });
});
