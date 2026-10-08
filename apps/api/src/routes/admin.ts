import * as S from "@stomp/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client.js";
import * as planner from "../services/planner.js";
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

  // ─── hub default categories (day planner, ADR-0006) ───
  app.get("/admin/default-categories", { schema: { response: { 200: z.array(S.defaultCategory) } } }, async (req) => {
    await users.assertAdmin(db, req.ctx);
    return planner.listDefaultCategories(db);
  });
  app.post("/admin/default-categories", { schema: { body: S.createCategory } }, async (req, reply) => {
    await users.assertAdmin(db, req.ctx);
    reply.code(201);
    return planner.addDefaultCategory(db, req.body);
  });
  app.patch(
    "/admin/default-categories/:id",
    { schema: { params: idParams, body: S.updateCategory, response: { 200: S.defaultCategory } } },
    async (req) => {
      await users.assertAdmin(db, req.ctx);
      return planner.updateDefaultCategory(db, req.params.id, req.body);
    },
  );
  app.delete("/admin/default-categories/:id", { schema: { params: idParams } }, async (req, reply) => {
    await users.assertAdmin(db, req.ctx);
    await planner.deleteDefaultCategory(db, req.params.id);
    reply.code(204);
  });
};
