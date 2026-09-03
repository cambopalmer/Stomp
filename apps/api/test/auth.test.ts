import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { seed } from "../src/db/seed.js";

// A second app instance with the test bypass OFF — exercises the real session flow.
let app: FastifyInstance;

beforeAll(async () => {
  await seed();
  app = await buildApp({ authBypass: false });
});
afterAll(() => app.close());

const cookieFrom = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers["set-cookie"];
  const line = Array.isArray(raw) ? raw[0] : raw;
  return String(line).split(";")[0]!;
};

describe("auth", () => {
  it("protected routes 401 without a session", async () => {
    const r = await app.inject({ method: "GET", url: "/api/todos?topLevel=true" });
    expect(r.statusCode).toBe(401);
  });

  it("public routes are reachable without a session", async () => {
    expect((await app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
    const me = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(me.statusCode).toBe(200);
    expect(me.json().user).toBeNull();
  });

  it("signs up, gets a session, and can then reach protected routes", async () => {
    const signup = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { email: "new@stomp.local", password: "hunter2hunter2", displayName: "New Person" },
    });
    expect(signup.statusCode).toBe(201);
    expect(signup.json().email).toBe("new@stomp.local");

    const cookie = cookieFrom(signup);
    const todos = await app.inject({
      method: "GET",
      url: "/api/todos?topLevel=true",
      headers: { cookie },
    });
    expect(todos.statusCode).toBe(200);

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });
    expect(me.json().user.email).toBe("new@stomp.local");
  });

  it("rejects a duplicate email and a short password", async () => {
    const dup = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { email: "owner@stomp.local", password: "longenough1", displayName: "x" },
    });
    expect(dup.statusCode).toBe(409);

    const short = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { email: "x@stomp.local", password: "short", displayName: "x" },
    });
    expect(short.statusCode).toBe(400);
  });

  it("logs in with the seeded owner and logs out", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "owner@stomp.local", password: "stomp-dev-password" },
    });
    expect(login.statusCode).toBe(200);
    const cookie = cookieFrom(login);

    expect(
      (await app.inject({ method: "GET", url: "/api/projects", headers: { cookie } })).statusCode,
    ).toBe(200);

    const logout = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    expect(logout.statusCode).toBe(200);

    // the session is gone
    const after = await app.inject({ method: "GET", url: "/api/projects", headers: { cookie } });
    expect(after.statusCode).toBe(401);
  });

  it("logs in with the pamcalmer dev account", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "pamcalmer@stomp.local", password: "pamcalmer" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().email).toBe("pamcalmer@stomp.local");
  });

  it("rejects a wrong password", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "owner@stomp.local", password: "not-the-password" },
    });
    expect(r.statusCode).toBe(400);
  });
});
