import * as S from "@stomp/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client.js";
import * as users from "../services/users.js";

const idParams = z.object({ id: z.string().uuid() });

/** User management. Every handler re-checks the admin role in the service. */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/admin/users", { schema: { response: { 200: z.array(S.adminUser) } } }, async (req) =>
    users.listUsers(db, req.ctx),
  );

  app.patch(
    "/admin/users/:id",
    { schema: { params: idParams, body: S.adminUpdateUser, response: { 200: S.adminUser } } },
    async (req) => users.updateUser(db, req.ctx, req.params.id, req.body),
  );

  app.post(
    "/admin/users/:id/password",
    { schema: { params: idParams, body: S.adminResetPassword } },
    async (req, reply) => {
      await users.resetPassword(db, req.ctx, req.params.id, req.body.password);
      reply.code(204);
    },
  );

  app.delete("/admin/users/:id", { schema: { params: idParams } }, async (req, reply) => {
    await users.deleteUser(db, req.ctx, req.params.id);
    reply.code(204);
  });
};
