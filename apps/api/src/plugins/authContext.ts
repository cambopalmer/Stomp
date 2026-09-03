import { eq } from "drizzle-orm";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { SESSION_COOKIE } from "../lib/cookies.js";
import { AppError } from "../lib/errors.js";
import type { Ctx } from "../services/access.js";
import { resolveSession } from "../services/auth.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Guaranteed set for any route that isn't in PUBLIC_PREFIXES. */
    ctx: Ctx;
    currentUser: typeof users.$inferSelect | undefined;
  }
}

/** Paths (after the /api prefix) reachable without a session. */
const PUBLIC_PREFIXES = [
  "/api/health",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/google",
  "/api/sitemap.xml",
  "/api/robots.txt",
];
const isPublic = (url: string) => PUBLIC_PREFIXES.some((p) => url === p || url.startsWith(`${p}?`) || url.startsWith(`${p}/`));

async function testBypassUser() {
  const [u] = await db.select().from(users).where(eq(users.email, config.SEED_USER_EMAIL)).limit(1);
  return u;
}

export interface AuthContextOptions {
  /** override config.AUTH_TEST_BYPASS (tests only) */
  testBypass?: boolean;
}

export const authContext = fp<AuthContextOptions>(async (app, opts) => {
  const bypass = opts.testBypass ?? config.AUTH_TEST_BYPASS;

  app.addHook("onRequest", async (request: FastifyRequest) => {
    const raw = request.cookies[SESSION_COOKIE];
    const unsigned = raw ? request.unsignCookie(raw) : { valid: false as const, value: null };

    let user: typeof users.$inferSelect | undefined;
    if (unsigned.valid && unsigned.value) {
      user = (await resolveSession(db, unsigned.value)) ?? undefined;
    }
    if (!user && bypass) {
      user = (await testBypassUser()) ?? undefined;
    }

    request.currentUser = user;
    if (user) request.ctx = { userId: user.id };

    if (!user && !isPublic(request.url)) {
      throw new AppError(401, "unauthenticated", "Sign in to continue");
    }
  });
});
