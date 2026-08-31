import { describe, expect, it } from "vitest";
import { createTodo, triageIncoming, createEvent } from "./index.js";

describe("createTodo", () => {
  it("requires a non-empty title", () => {
    expect(createTodo.safeParse({ title: "" }).success).toBe(false);
    expect(createTodo.safeParse({ title: "  " }).success).toBe(false);
    expect(createTodo.safeParse({ title: "Ship it" }).success).toBe(true);
  });

  it("trims the title", () => {
    const parsed = createTodo.parse({ title: "  hello  " });
    expect(parsed.title).toBe("hello");
  });
});

describe("createEvent", () => {
  it("rejects end before start", () => {
    const r = createEvent.safeParse({ title: "x", startsAt: 200, endsAt: 100 });
    expect(r.success).toBe(false);
  });
});

describe("triageIncoming", () => {
  it("discriminates on target", () => {
    expect(triageIncoming.safeParse({ target: "dismiss" }).success).toBe(true);
    expect(triageIncoming.safeParse({ target: "todo", title: "do" }).success).toBe(true);
    expect(triageIncoming.safeParse({ target: "event", title: "meet", startsAt: 1, endsAt: 2 }).success).toBe(true);
    expect(triageIncoming.safeParse({ target: "event", title: "meet" }).success).toBe(false);
  });
});
