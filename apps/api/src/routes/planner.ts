import * as S from "@stomp/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client.js";
import * as planner from "../services/planner.js";

const idParams = z.object({ id: z.string().uuid() });
const dateParams = z.object({ date: S.isoDate });

/** Day planner (ADR-0006). Everything here is the signed-in user's own. */
export const plannerRoutes: FastifyPluginAsyncZod = async (app) => {
  // ─── a day ───
  app.get("/plan/:date", { schema: { params: dateParams, response: { 200: S.dayPlan } } }, async (req) =>
    planner.getDayPlan(db, req.ctx, req.params.date),
  );
  app.put("/plan/:date/notes", { schema: { params: dateParams, body: S.dayNotesInput } }, async (req) =>
    planner.saveDayNotes(db, req.ctx, req.params.date, req.body.body),
  );

  // ─── blocks ───
  app.post(
    "/time-blocks",
    { schema: { body: S.createTimeBlock, response: { 201: S.timeBlock } } },
    async (req, reply) => {
      reply.code(201);
      return planner.createBlock(db, req.ctx, req.body);
    },
  );
  app.patch(
    "/time-blocks/:id",
    { schema: { params: idParams, body: S.updateTimeBlock, response: { 200: S.timeBlock } } },
    async (req) => planner.updateBlock(db, req.ctx, req.params.id, req.body),
  );
  app.delete("/time-blocks/:id", { schema: { params: idParams } }, async (req, reply) => {
    await planner.deleteBlock(db, req.ctx, req.params.id);
    reply.code(204);
  });

  // ─── categories ───
  app.get("/categories", { schema: { response: { 200: z.array(S.category) } } }, async (req) =>
    planner.listCategories(db, req.ctx),
  );
  app.post(
    "/categories",
    { schema: { body: S.createCategory, response: { 201: S.category } } },
    async (req, reply) => {
      reply.code(201);
      return planner.createCategory(db, req.ctx, req.body);
    },
  );
  app.patch(
    "/categories/:id",
    { schema: { params: idParams, body: S.updateCategory, response: { 200: S.category } } },
    async (req) => planner.updateCategory(db, req.ctx, req.params.id, req.body),
  );
  app.delete("/categories/:id", { schema: { params: idParams } }, async (req) =>
    planner.deleteCategory(db, req.ctx, req.params.id),
  );

  // ─── the user's timezone (reported by the browser) ───
  app.put("/me/timezone", { schema: { body: S.timezoneInput } }, async (req) =>
    planner.setTimezone(db, req.ctx, req.body.timezone),
  );
};
