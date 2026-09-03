import oauth2, { type OAuth2Namespace, type ProviderConfiguration } from "@fastify/oauth2";

const GOOGLE_CONFIGURATION = (oauth2 as unknown as { GOOGLE_CONFIGURATION: ProviderConfiguration })
  .GOOGLE_CONFIGURATION;
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { config } from "../config.js";

declare module "fastify" {
  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace;
  }
}

/**
 * Registers `GET /api/auth/google` (start) — the callback handler lives in
 * routes/auth.ts. No-op unless GOOGLE_CLIENT_ID/SECRET are set.
 */
export const googleOAuth: FastifyPluginAsync = fp(async (app) => {
  if (!config.googleOAuthConfigured) return;

  await app.register(oauth2, {
    name: "googleOAuth2",
    scope: ["openid", "email", "profile"],
    credentials: {
      client: {
        id: config.GOOGLE_CLIENT_ID!,
        secret: config.GOOGLE_CLIENT_SECRET!,
      },
      auth: GOOGLE_CONFIGURATION,
    },
    startRedirectPath: "/api/auth/google",
    callbackUri: `${config.PUBLIC_BASE_URL}/api/auth/google/callback`,
  });
});
