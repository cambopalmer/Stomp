import type { FastifyReply } from "fastify";
import { config } from "../config.js";

export const SESSION_COOKIE = "stomp_session";

const base = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.isProd,
  path: "/",
};

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    ...base,
    signed: true,
    maxAge: 30 * 24 * 60 * 60, // seconds
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, base);
}
