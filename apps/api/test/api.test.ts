import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { seed } from "../src/db/seed.js";

let app: FastifyInstance;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  await seed(); // uses DATABASE_URL from env; CI points it at a scratch file
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

const get = (url: string) => app.inject({ method: "GET", url });

describe("health + read endpoints", () => {
  it("GET /api/health", async () => {
    const r = await get("/api/health");
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
  });

  it.each([
    "/api/home/summary",
    "/api/home/hot",
    "/api/todos?topLevel=true",
    "/api/projects",
    "/api/events",
    "/api/references",
    "/api/incoming-items",
    "/api/workspaces",
    "/api/tags",
  ])("GET %s -> 200", async (url) => {
    const r = await get(url);
    expect(r.statusCode, r.body).toBe(200);
  });

  it("home summary reflects seed data", async () => {
    const s = (await get("/api/home/summary")).json();
    expect(s.todos.overdue).toBeGreaterThanOrEqual(1);
    expect(s.incoming.unread).toBeGreaterThanOrEqual(2);
    expect(s.projects.active).toBe(2);
  });

  it("hot list buckets the overdue todo first", async () => {
    const hot = (await get("/api/home/hot")).json();
    expect(hot.todos.length).toBeGreaterThan(0);
    expect(hot.todos[0].bucket).toBe("overdue");
  });

  it("sitemap lists project + todo urls", async () => {
    const r = await get("/api/sitemap.xml");
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain("/projects/");
    expect(r.body).toContain("/todos/");
  });
});

describe("todos CRUD", () => {
  it("creates, trims title, reads back, updates, completes, deletes", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/todos",
      payload: { title: "  write more tests  ", priority: "high" },
    });
    expect(created.statusCode).toBe(201);
    const todo = created.json();
    expect(todo.title).toBe("write more tests");

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/todos/${todo.id}`,
      payload: { status: "done" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().status).toBe("done");
    expect(patched.json().completedAt).toBeTypeOf("number");

    const del = await app.inject({ method: "DELETE", url: `/api/todos/${todo.id}` });
    expect(del.statusCode).toBe(204);

    const gone = await get(`/api/todos/${todo.id}`);
    expect(gone.statusCode).toBe(404);
  });

  it("rejects an empty title", async () => {
    const r = await app.inject({ method: "POST", url: "/api/todos", payload: { title: "  " } });
    expect(r.statusCode).toBe(400);
  });

  it("subtask inherits parent project", async () => {
    const projects = (await get("/api/projects")).json();
    const projectId = projects[0].id;
    const parent = (
      await app.inject({ method: "POST", url: "/api/todos", payload: { title: "parent", projectId } })
    ).json();
    const child = (
      await app.inject({
        method: "POST",
        url: "/api/todos",
        payload: { title: "child", parentTodoId: parent.id },
      })
    ).json();
    expect(child.projectId).toBe(projectId);
  });
});

describe("tags + activity", () => {
  it("tags an item, lists it on a tag page, and untags it", async () => {
    const todo = (
      await app.inject({ method: "POST", url: "/api/todos", payload: { title: "taggable" } })
    ).json();
    const tag = (await app.inject({ method: "POST", url: "/api/tags", payload: { name: "focus" } })).json();

    const applied = await app.inject({
      method: "POST",
      url: "/api/taggings",
      payload: { tagId: tag.id, entityType: "todo", entityId: todo.id },
    });
    expect(applied.statusCode).toBe(200);

    const onEntity = await get(`/api/taggings?entityType=todo&entityId=${todo.id}`);
    expect(onEntity.json().map((t: { name: string }) => t.name)).toContain("focus");

    const items = await get(`/api/tags/${tag.id}/items`);
    expect(items.json().todos.map((t: { id: string }) => t.id)).toContain(todo.id);

    const removed = await app.inject({
      method: "DELETE",
      url: "/api/taggings",
      payload: { tagId: tag.id, entityType: "todo", entityId: todo.id },
    });
    expect(removed.statusCode).toBe(200);
  });

  it("records activity for a todo", async () => {
    const todo = (
      await app.inject({ method: "POST", url: "/api/todos", payload: { title: "trackable" } })
    ).json();
    await app.inject({ method: "PATCH", url: `/api/todos/${todo.id}`, payload: { status: "done" } });
    const activity = await get(`/api/activity?entityType=todo&entityId=${todo.id}`);
    const actions = activity.json().map((a: { action: string }) => a.action);
    expect(actions).toContain("created");
    expect(actions).toContain("completed");
  });
});

describe("incoming triage", () => {
  it("converts an incoming item to a todo", async () => {
    const item = (
      await app.inject({ method: "POST", url: "/api/incoming-items", payload: { title: "buy milk" } })
    ).json();
    const res = await app.inject({
      method: "POST",
      url: `/api/incoming-items/${item.id}/triage`,
      payload: { target: "todo", title: "Buy milk" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("triaged");
    expect(res.json().linkedEntityType).toBe("todo");
  });
});
