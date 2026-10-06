import { randomBytes } from "node:crypto";
import * as S from "@stomp/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { AppError } from "../lib/errors.js";
import { GrantRevoked } from "../lib/google.js";
import { logger } from "../lib/logger.js";
import * as integrations from "../services/integrations.js";
import * as sync from "../services/sync.js";

const STATE_COOKIE = "stomp_oauth_state";
const CALLBACK_PATH = "/api/integrations/google/callback";
const idParams = z.object({ id: z.string().uuid() });

/** Back to Settings with a short, known outcome code the UI turns into a message. */
const toSettings = (q: Record<string, string>) => `${config.WEB_ORIGIN}/settings?${new URLSearchParams(q)}`;

export const integrationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/integrations", { schema: { response: { 200: S.integrationsResponse } } }, async (req) =>
    integrations.listAccounts(db, req.ctx),
  );

  // Browser navigation (not XHR): start the Google consent flow for one product.
  app.get(
    "/integrations/google/connect",
    { schema: { querystring: z.object({ product: S.integrationProduct }) } },
    async (req, reply) => {
      const state = randomBytes(24).toString("base64url");
      const url = integrations.connectUrl(req.query.product, state);
      // bind state to this user + product; checked (and cleared) on the way back
      reply.setCookie(STATE_COOKIE, `${state}.${req.query.product}.${req.ctx.userId}`, {
        signed: true,
        httpOnly: true,
        sameSite: "lax", // must survive the top-level redirect back from Google
        secure: config.isProd,
        path: CALLBACK_PATH,
        maxAge: 10 * 60,
      });
      return reply.redirect(url);
    },
  );

  app.get(
    "/integrations/google/callback",
    {
      schema: {
        querystring: z.object({
          code: z.string().optional(),
          state: z.string().optional(),
          error: z.string().optional(),
        }),
      },
    },
    async (req, reply) => {
      const raw = req.cookies[STATE_COOKIE];
      reply.clearCookie(STATE_COOKIE, { path: CALLBACK_PATH });
      const unsigned = raw ? req.unsignCookie(raw) : { valid: false as const, value: null };
      const [state, product, userId] = unsigned.valid && unsigned.value ? unsigned.value.split(".") : [];
      const parsedProduct = S.integrationProduct.safeParse(product);

      if (
        !req.query.state ||
        req.query.state !== state ||
        userId !== req.ctx.userId ||
        !parsedProduct.success
      ) {
        logger.warn({ userId: req.ctx.userId }, "integration callback: state mismatch");
        return reply.redirect(toSettings({ error: "state" }));
      }
      if (req.query.error || !req.query.code) {
        // e.g. access_denied when the user cancels on Google's screen
        return reply.redirect(toSettings({ error: req.query.error === "access_denied" ? "denied" : "google" }));
      }
      try {
        const row = await integrations.completeConnect(db, req.ctx, parsedProduct.data, req.query.code);
        // first import in the background — the user lands on Settings while it runs
        void sync.syncAccount(db, row).catch((err) => logger.error({ err }, "initial sync failed"));
        return reply.redirect(toSettings({ connected: parsedProduct.data }));
      } catch (e) {
        const msg = e instanceof AppError || e instanceof GrantRevoked ? e.message : "Couldn't finish connecting";
        if (!(e instanceof AppError)) logger.error({ err: e }, "integration callback failed");
        return reply.redirect(toSettings({ error: "connect", message: msg }));
      }
    },
  );

  app.post(
    "/integrations/:id/sync",
    { schema: { params: idParams, response: { 200: S.integrationAccount } } },
    async (req) => sync.syncNow(db, req.ctx, req.params.id),
  );

  app.put(
    "/integrations/:id/calendars",
    { schema: { params: idParams, body: S.selectCalendarsInput, response: { 200: S.integrationAccount } } },
    async (req) => sync.selectCalendars(db, req.ctx, req.params.id, req.body.calendarIds),
  );

  app.delete("/integrations/:id", { schema: { params: idParams } }, async (req, reply) => {
    await integrations.disconnect(db, req.ctx, req.params.id);
    reply.code(204);
  });
};
