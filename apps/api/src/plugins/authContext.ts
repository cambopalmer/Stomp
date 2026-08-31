import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import type { Ctx } from "../services/access.js";

declare module "fastify" {
  interface FastifyRequest {
    ctx: Ctx;
    /** The acting user's row (timezone etc). */
    currentUser: typeof users.$inferSelect;
  }
}

/**
 * Phase 0: every request acts as the seeded user (SEED_USER_EMAIL).
 * Phase 3 swaps only this plugin for real session/JWT verification —
 * services and routes take `request.ctx` and are untouched.
 */
export const authContext: FastifyPluginAsync = fp(async (app) => {
  let cached: typeof users.$inferSelect | null = null;

  app.addHook("onRequest", async (request) => {
    if (!cached) {
      const [u] = await db.select().from(users).where(eq(users.email, config.SEED_USER_EMAIL)).limit(1);
      if (!u) throw new Error(`Seed user ${config.SEED_USER_EMAIL} not found — run \`pnpm db:seed\``);
      cached = u;
    }
    request.currentUser = cached;
    request.ctx = { userId: cached.id };
  });
});
