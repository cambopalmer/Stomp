import * as S from "@stomp/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from "../lib/cookies.js";
import { BadRequest } from "../lib/errors.js";
import * as auth from "../services/auth.js";

const meta = (req: { headers: Record<string, unknown>; ip: string }) => ({
  userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
  ip: req.ip,
});

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/auth/me", { schema: { response: { 200: S.meResponse } } }, async (req) => {
    return {
      user: req.currentUser ? auth.toAuthUser(req.currentUser) : null,
      googleEnabled: config.googleOAuthConfigured,
      signupOpen: config.ALLOW_SIGNUP,
    };
  });

  app.post(
    "/auth/signup",
    { schema: { body: S.signupInput, response: { 201: S.authUser } } },
    async (req, reply) => {
      const user = await auth.signup(db, req.body, { allowSignup: config.ALLOW_SIGNUP });
      const token = await auth.createSession(db, user.id, meta(req));
      setSessionCookie(reply, token);
      reply.code(201);
      return auth.toAuthUser(user);
    },
  );

  app.post(
    "/auth/login",
    { schema: { body: S.credentials, response: { 200: S.authUser } } },
    async (req, reply) => {
      const user = await auth.login(db, req.body.email, req.body.password);
      await auth.pruneExpiredSessions(db);
      const token = await auth.createSession(db, user.id, meta(req));
      setSessionCookie(reply, token);
      return auth.toAuthUser(user);
    },
  );

  app.post("/auth/logout", async (req, reply) => {
    const raw = req.cookies[SESSION_COOKIE];
    const unsigned = raw ? req.unsignCookie(raw) : { valid: false as const, value: null };
    if (unsigned.valid && unsigned.value) await auth.destroySession(db, unsigned.value);
    clearSessionCookie(reply);
    return { ok: true };
  });

  // ─── Google OAuth callback (the /auth/google redirect is registered in app.ts) ───
  if (config.googleOAuthConfigured) {
    app.get("/auth/google/callback", async (req, reply) => {
      const { token } =
        await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
      const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      if (!res.ok) throw BadRequest("Google sign-in failed");
      const profile = (await res.json()) as {
        sub: string;
        email: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
      };
      if (!profile.email || profile.email_verified === false) {
        throw BadRequest("Your Google account has no verified email");
      }
      const user = await auth.upsertGoogleUser(db, profile);
      const sessionToken = await auth.createSession(db, user.id, meta(req));
      setSessionCookie(reply, sessionToken);
      return reply.redirect(config.WEB_ORIGIN + "/");
    });
  }
};
