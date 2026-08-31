import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from "fastify-type-provider-zod";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

export const errorHandler: FastifyPluginAsync = fp(async (app) => {
  app.setErrorHandler((err, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.status(400).send({
        error: "bad_request",
        message: "Request does not match the expected shape",
        details: err.validation,
      });
    }
    if (isResponseSerializationError(err)) {
      request.log.error({ err }, "response serialization failed");
      return reply.status(500).send({ error: "internal", message: "Response shape mismatch" });
    }
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: err.code, message: err.message, details: err.details });
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: "bad_request", message: "Validation failed", details: err.flatten() });
    }
    request.log.error({ err }, "unhandled error");
    return reply.status(500).send({ error: "internal", message: "Something went wrong" });
  });
});
