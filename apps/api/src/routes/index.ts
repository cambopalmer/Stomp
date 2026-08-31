import * as S from "@stomp/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/client.js";
import { buildSitemap, robotsTxt } from "../lib/sitemap.js";
import * as events from "../services/events.js";
import * as home from "../services/home.js";
import * as incoming from "../services/incoming.js";
import * as projects from "../services/projects.js";
import * as references from "../services/references.js";
import * as tags from "../services/tags.js";
import * as todos from "../services/todos.js";
import * as workspaces from "../services/workspaces.js";

const idParams = z.object({ id: z.string().uuid() });

export const routes: FastifyPluginAsyncZod = async (app) => {
  app.get("/health", { schema: { response: { 200: z.object({ ok: z.literal(true) }) } } }, async () => ({
    ok: true as const,
  }));

  // ─── home ───────────────────────────────────────────
  app.get("/home/summary", async (req) => home.homeSummary(db, req.ctx, req.currentUser.timezone));
  app.get("/home/hot", async (req) => home.hotList(db, req.ctx, req.currentUser.timezone));

  // ─── todos ──────────────────────────────────────────
  app.get(
    "/todos",
    { schema: { querystring: z.object({ status: z.string().optional(), projectId: z.string().uuid().optional(), topLevel: z.coerce.boolean().optional() }) } },
    async (req) =>
      todos.listTodos(db, req.ctx, {
        status: req.query.status,
        projectId: req.query.projectId,
        parentTodoId: req.query.topLevel ? null : undefined,
      }),
  );
  app.post("/todos", { schema: { body: S.createTodo } }, async (req, reply) => {
    reply.code(201);
    return todos.createTodo(db, req.ctx, req.body);
  });
  app.get("/todos/:id", { schema: { params: idParams } }, async (req) => todos.getTodo(db, req.ctx, req.params.id));
  app.patch("/todos/:id", { schema: { params: idParams, body: S.updateTodo } }, async (req) =>
    todos.updateTodo(db, req.ctx, req.params.id, req.body),
  );
  app.delete("/todos/:id", { schema: { params: idParams } }, async (req, reply) => {
    await todos.deleteTodo(db, req.ctx, req.params.id);
    reply.code(204);
  });

  // ─── projects ───────────────────────────────────────
  app.get("/projects", async (req) => projects.listProjects(db, req.ctx));
  app.post("/projects", { schema: { body: S.createProject } }, async (req, reply) => {
    reply.code(201);
    return projects.createProject(db, req.ctx, req.body);
  });
  app.get("/projects/:id", { schema: { params: idParams } }, async (req) => projects.getProject(db, req.ctx, req.params.id));
  app.patch("/projects/:id", { schema: { params: idParams, body: S.updateProject } }, async (req) =>
    projects.updateProject(db, req.ctx, req.params.id, req.body),
  );
  app.delete("/projects/:id", { schema: { params: idParams } }, async (req, reply) => {
    await projects.deleteProject(db, req.ctx, req.params.id);
    reply.code(204);
  });

  // ─── events ─────────────────────────────────────────
  app.get(
    "/events",
    { schema: { querystring: z.object({ from: z.coerce.number().optional(), to: z.coerce.number().optional() }) } },
    async (req) => events.listEvents(db, req.ctx, { from: req.query.from, to: req.query.to }),
  );
  app.post("/events", { schema: { body: S.createEvent } }, async (req, reply) => {
    reply.code(201);
    return events.createEvent(db, req.ctx, req.body);
  });
  app.get("/events/:id", { schema: { params: idParams } }, async (req) => events.getEvent(db, req.ctx, req.params.id));
  app.patch("/events/:id", { schema: { params: idParams, body: S.updateEvent } }, async (req) =>
    events.updateEvent(db, req.ctx, req.params.id, req.body),
  );
  app.delete("/events/:id", { schema: { params: idParams } }, async (req, reply) => {
    await events.deleteEvent(db, req.ctx, req.params.id);
    reply.code(204);
  });

  // ─── references ─────────────────────────────────────
  app.get(
    "/references",
    { schema: { querystring: z.object({ status: z.string().optional() }) } },
    async (req) => references.listReferences(db, req.ctx, { status: req.query.status }),
  );
  app.post("/references", { schema: { body: S.createReference } }, async (req, reply) => {
    reply.code(201);
    return references.createReference(db, req.ctx, req.body);
  });
  app.get("/references/:id", { schema: { params: idParams } }, async (req) =>
    references.getReference(db, req.ctx, req.params.id),
  );
  app.patch("/references/:id", { schema: { params: idParams, body: S.updateReference } }, async (req) =>
    references.updateReference(db, req.ctx, req.params.id, req.body),
  );
  app.delete("/references/:id", { schema: { params: idParams } }, async (req, reply) => {
    await references.deleteReference(db, req.ctx, req.params.id);
    reply.code(204);
  });

  // ─── incoming ───────────────────────────────────────
  app.get(
    "/incoming-items",
    { schema: { querystring: z.object({ status: z.string().default("unread") }) } },
    async (req) => incoming.listIncoming(db, req.ctx, req.query.status),
  );
  app.post("/incoming-items", { schema: { body: S.createIncoming } }, async (req, reply) => {
    reply.code(201);
    return incoming.createIncoming(db, req.ctx, req.body);
  });
  app.post(
    "/incoming-items/:id/triage",
    { schema: { params: idParams, body: S.triageIncoming } },
    async (req) => incoming.triageIncoming(db, req.ctx, req.params.id, req.body),
  );

  // ─── tags ───────────────────────────────────────────
  app.get("/tags", async (req) => tags.listTags(db, req.ctx));
  app.post("/tags", { schema: { body: S.createTag } }, async (req, reply) => {
    reply.code(201);
    return tags.createTag(db, req.ctx, req.body);
  });
  app.post("/taggings", { schema: { body: S.applyTag } }, async (req) => tags.applyTag(db, req.ctx, req.body));
  app.delete("/taggings", { schema: { body: S.applyTag } }, async (req) => tags.removeTag(db, req.ctx, req.body));

  // ─── workspaces ─────────────────────────────────────
  app.get("/workspaces", async (req) => workspaces.listWorkspaces(db, req.ctx));
  app.post("/workspaces", { schema: { body: S.createWorkspace } }, async (req, reply) => {
    reply.code(201);
    return workspaces.createWorkspace(db, req.ctx, req.body);
  });
  app.post(
    "/workspaces/:id/members",
    { schema: { params: idParams, body: S.addWorkspaceMember } },
    async (req, reply) => {
      reply.code(201);
      return workspaces.addMember(db, req.ctx, req.params.id, req.body);
    },
  );

  // ─── sitemap ────────────────────────────────────────
  app.get("/sitemap.xml", async (_req, reply) => {
    reply.header("content-type", "application/xml");
    return buildSitemap();
  });
  app.get("/robots.txt", async (_req, reply) => {
    reply.header("content-type", "text/plain");
    return robotsTxt;
  });
};
