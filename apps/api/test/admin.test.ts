import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { todos, users } from "../src/db/schema.js";
import { seed } from "../src/db/seed.js";

// Real sessions (bypass OFF): these tests are about who is allowed to do what.
let app: FastifyInstance;
let admin: string; // cookie for owner@stomp.local (seeded admin)
let member: string; // cookie for sam@stomp.local (seeded member)
const PW = "stomp-dev-password";

const cookieFrom = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers["set-cookie"];
  return String(Array.isArray(raw) ? raw[0] : raw).split(";")[0]!;
};
const login = async (email: string, password = PW) =>
  app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
const as = (cookie: string, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie }, payload });

let seq = 0;
async function newUser() {
  const email = `adm-${Date.now()}-${seq++}@stomp.local`;
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/signup",
    payload: { email, password: "hunter2hunter2", displayName: "Temp" },
  });
  expect(r.statusCode).toBe(201);
  return { id: r.json().id as string, email, cookie: cookieFrom(r) };
}

beforeAll(async () => {
  await seed();
  app = await buildApp({ authBypass: false });
  admin = cookieFrom(await login("owner@stomp.local"));
  member = cookieFrom(await login("sam@stomp.local"));
});
afterAll(() => app.close());

describe("admin: access", () => {
  it("/auth/me reports the role", async () => {
    expect((await as(admin, "GET", "/api/auth/me")).json().user.role).toBe("admin");
    expect((await as(member, "GET", "/api/auth/me")).json().user.role).toBe("member");
  });

  it("members get 403 on every admin route; admins can list users", async () => {
    const someone = (await as(admin, "GET", "/api/admin/users")).json()[0].id;
    expect((await as(member, "GET", "/api/admin/users")).statusCode).toBe(403);
    expect((await as(member, "PATCH", `/api/admin/users/${someone}`, { role: "admin" })).statusCode).toBe(403);
    expect((await as(member, "POST", `/api/admin/users/${someone}/password`, { password: "xxxxxxxxxx" })).statusCode).toBe(403);
    expect((await as(member, "DELETE", `/api/admin/users/${someone}`)).statusCode).toBe(403);

    const list = await as(admin, "GET", "/api/admin/users");
    expect(list.statusCode).toBe(200);
    const row = list.json().find((u: { email: string }) => u.email === "sam@stomp.local");
    expect(row).toMatchObject({ role: "member", disabledAt: null, deletedAt: null });
    expect(row).not.toHaveProperty("passwordHash");
  });
});

describe("admin: guards", () => {
  it("won't remove the last admin, or let you disable / delete yourself", async () => {
    const me = (await as(admin, "GET", "/api/auth/me")).json().user.id;
    expect((await as(admin, "PATCH", `/api/admin/users/${me}`, { role: "member" })).statusCode).toBe(400);
    expect((await as(admin, "PATCH", `/api/admin/users/${me}`, { disabled: true })).statusCode).toBe(400);
    expect((await as(admin, "DELETE", `/api/admin/users/${me}`)).statusCode).toBe(400);
  });

  it("promote then demote works once there's a second admin", async () => {
    const u = await newUser();
    const up = await as(admin, "PATCH", `/api/admin/users/${u.id}`, { role: "admin" });
    expect(up.json().role).toBe("admin");
    expect((await as(u.cookie, "GET", "/api/admin/users")).statusCode).toBe(200);
    const down = await as(admin, "PATCH", `/api/admin/users/${u.id}`, { role: "member" });
    expect(down.json().role).toBe("member");
    expect((await as(u.cookie, "GET", "/api/admin/users")).statusCode).toBe(403);
  });
});

describe("admin: disable / reset password", () => {
  it("disabling signs the user out and blocks login; enabling restores it", async () => {
    const u = await newUser();
    expect((await as(u.cookie, "GET", "/api/todos")).statusCode).toBe(200);

    await as(admin, "PATCH", `/api/admin/users/${u.id}`, { disabled: true });
    expect((await as(u.cookie, "GET", "/api/todos")).statusCode).toBe(401);
    const blocked = await login(u.email, "hunter2hunter2");
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error).toBe("account_disabled");
    // a wrong password still says "wrong password" — account state isn't leaked to guessers
    expect((await login(u.email, "not-the-password")).statusCode).toBe(400);

    await as(admin, "PATCH", `/api/admin/users/${u.id}`, { disabled: false });
    expect((await login(u.email, "hunter2hunter2")).statusCode).toBe(200);
  });

  it("reset password: new one works, old one and old sessions don't", async () => {
    const u = await newUser();
    const r = await as(admin, "POST", `/api/admin/users/${u.id}/password`, { password: "brand-new-pass" });
    expect(r.statusCode).toBe(204);
    expect((await as(u.cookie, "GET", "/api/todos")).statusCode).toBe(401);
    expect((await login(u.email, "hunter2hunter2")).statusCode).toBe(400);
    expect((await login(u.email, "brand-new-pass")).statusCode).toBe(200);
  });
});

describe("admin: delete = anonymize", () => {
  it("removes private items, keeps shared ones as 'Deleted user', frees the email", async () => {
    const u = await newUser();
    const mk = async (payload: object) => (await as(u.cookie, "POST", "/api/todos", payload)).json();
    const privateTodo = await mk({ title: "only mine" });
    const privateChild = await mk({ title: "only mine, sub", parentTodoId: privateTodo.id });
    const sharedTodo = await mk({ title: "shared with owner" });
    expect(
      (await as(u.cookie, "POST", `/api/todos/${sharedTodo.id}/collaborators`, { email: "owner@stomp.local" }))
        .statusCode,
    ).toBe(201);

    const del = await as(admin, "DELETE", `/api/admin/users/${u.id}`);
    expect(del.statusCode).toBe(204);

    // private ones are gone (checked in the DB — nobody else could see them via the API)
    const left = await db.select({ id: todos.id }).from(todos).where(eq(todos.createdBy, u.id));
    expect(left.map((t) => t.id)).toEqual([sharedTodo.id]);
    expect(left.map((t) => t.id)).not.toContain(privateChild.id);

    // the shared one survives for the person it was shared with
    const seen = await as(admin, "GET", `/api/todos/${sharedTodo.id}`);
    expect(seen.statusCode).toBe(200);
    expect(seen.json().createdBy).toBe(u.id);

    // the user row is a tombstone
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row).toMatchObject({ displayName: "Deleted user", passwordHash: null, googleId: null });
    expect(row!.email).not.toBe(u.email);
    expect(row!.deletedAt).toBeTypeOf("number");

    // signed out, can't sign in, and the address can register again
    expect((await as(u.cookie, "GET", "/api/todos")).statusCode).toBe(401);
    expect((await login(u.email, "hunter2hunter2")).statusCode).toBe(400);
    const again = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { email: u.email, password: "hunter2hunter2", displayName: "Back" },
    });
    expect(again.statusCode).toBe(201);
    expect(again.json().id).not.toBe(u.id);

    // deleted users can't be edited or deleted again
    expect((await as(admin, "PATCH", `/api/admin/users/${u.id}`, { role: "admin" })).statusCode).toBe(404);
    expect((await as(admin, "DELETE", `/api/admin/users/${u.id}`)).statusCode).toBe(404);
  });

  it("a workspace only they were in is removed; a shared one gets a new owner", async () => {
    const u = await newUser();
    const solo = (await as(u.cookie, "POST", "/api/workspaces", { name: `solo ${Date.now()}` })).json();
    const shared = (await as(u.cookie, "POST", "/api/workspaces", { name: `shared ${Date.now()}` })).json();
    const add = await as(u.cookie, "POST", `/api/workspaces/${shared.id}/members`, {
      email: "sam@stomp.local",
      role: "editor",
    });
    expect(add.statusCode).toBeLessThan(300);

    await as(admin, "DELETE", `/api/admin/users/${u.id}`);

    const samWs = (await as(member, "GET", "/api/workspaces")).json() as { id: string; role?: string }[];
    expect(samWs.map((w) => w.id)).toContain(shared.id);
    expect(samWs.map((w) => w.id)).not.toContain(solo.id);
    const members = (await as(member, "GET", `/api/workspaces/${shared.id}/members`)).json() as {
      userId: string;
      role: string;
    }[];
    expect(members.map((m) => m.userId)).not.toContain(u.id);
    expect(members.find((m) => m.role === "owner")).toBeTruthy();
  });
});
