import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { config } from "./config.js";
import { loggerOptions } from "./lib/logger.js";
import { authContext } from "./plugins/authContext.js";
import { errorHandler } from "./plugins/errorHandler.js";
import { routes } from "./routes/index.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.isTest ? false : loggerOptions,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(errorHandler);
  await app.register(authContext);
  await app.register(routes, { prefix: "/api" });

  return app;
}
