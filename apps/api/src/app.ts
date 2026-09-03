import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { authContext } from "./plugins/authContext.js";
import { errorHandler } from "./plugins/errorHandler.js";
import { googleOAuth } from "./plugins/googleOAuth.js";
import { authRoutes } from "./routes/auth.js";
import { routes } from "./routes/index.js";

export async function buildApp(opts: { authBypass?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: config.isTest ? undefined : (logger as unknown as FastifyBaseLogger),
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(cookie, { secret: config.SESSION_SECRET });
  await app.register(errorHandler);
  await app.register(googleOAuth);
  await app.register(authContext, { testBypass: opts.authBypass });
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(routes, { prefix: "/api" });

  return app;
}
