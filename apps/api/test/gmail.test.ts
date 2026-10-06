import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import { incomingItems, integrationAccounts, todos, users } from "../src/db/schema.js";
import { seed } from "../src/db/seed.js";
import { seal } from "../src/lib/crypto.js";
import { newId } from "../src/lib/ids.js";
import * as collab from "../src/services/collaborators.js";
import * as incoming from "../src/services/incoming.js";
import { syncAccount } from "../src/services/sync.js";

// AUTH_TEST_BYPASS: requests act as the seeded owner.
let app: FastifyInstance;
let ownerId: string;
let accountId: string;

/** Mutable fake Gmail. */
let labels: { id: string; name: string }[];
let messages: Record<string, { subject: string; from: string; snippet: string; labels: string[] }>;
let failMessage: string | null;

function stubGmail() {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const base = "/gmail/v1/users/me";
      if (url.pathname === `${base}/labels`) return json(200, { labels });
      if (url.pathname === `${base}/messages`) {
        const label = url.searchParams.get("labelIds")!;
        const ids = Object.entries(messages)
          .filter(([, m]) => m.labels.includes(label))
          .map(([id]) => ({ id, threadId: `t-${id}` }));
        return json(200, { messages: ids });
      }
      const m = url.pathname.match(new RegExp(`^${base}/messages/([^/]+)$`));
      if (m) {
        const id = decodeURIComponent(m[1]!);
        if (id === failMessage) return json(500, { error: { message: "Backend Error" } });
        expect(url.searchParams.get("format")).toBe("metadata"); // headers + snippet only, never bodies
        const msg = messages[id]!;
        return json(200, {
          id,
          threadId: `t-${id}`,
          snippet: msg.snippet,
          internalDate: "1791000000000",
          payload: { headers: [{ name: "Subject", value: msg.subject }, { name: "From", value: msg.from }] },
        });
      }
      return json(404, { error: { message: `unexpected ${url}` } });
    }),
  );
}

const row = async () => (await db.select().from(integrationAccounts).where(eq(integrationAccounts.id, accountId)))[0]!;
const sync = async () => syncAccount(db, await row());
const emails = () =>
  db.select().from(incomingItems).where(and(eq(incomingItems.forUserId, ownerId), eq(incomingItems.kind, "email")));

beforeAll(async () => {
  await seed();
  app = await buildApp();
  ownerId = (await db.select().from(users).where(eq(users.email, "owner@stomp.local")))[0]!.id;
});
afterAll(() => app.close());
afterEach(() => vi.unstubAllGlobals());

beforeEach(async () => {
  await db.delete(integrationAccounts).where(eq(integrationAccounts.userId, ownerId));
  await db.delete(incomingItems).where(and(eq(incomingItems.forUserId, ownerId), eq(incomingItems.kind, "email")));
  accountId = newId();
  await db.insert(integrationAccounts).values({
    id: accountId,
    userId: ownerId,
    provider: "gmail",
    email: "cam@gmail.com",
    accessToken: seal("at-live"),
    refreshToken: seal("rt-live"),
    tokenExpiresAt: Date.now() + 3600_000,
    scopes: "https://www.googleapis.com/auth/gmail.readonly",
    status: "connected",
  });
  labels = [
    { id: "INBOX", name: "INBOX" },
    { id: "Label_9", name: "STOMP" },
    { id: "Label_3", name: "stomp-ish" },
  ];
  messages = {
    m1: { subject: "Renew passport", from: "Gov <noreply@gov.example>", snippet: "Your passport expires &amp; you&#39;ll need…", labels: ["INBOX", "Label_9"] },
    m2: { subject: "", from: "a@b.example", snippet: "no subject here", labels: ["Label_9"] },
    m3: { subject: "Newsletter", from: "news@x.example", snippet: "unrelated", labels: ["INBOX", "Label_3"] },
  };
  failMessage = null;
  stubGmail();
});

describe("gmail → incoming", () => {
  it("imports only STOMP-labelled messages as email items, once", async () => {
    const r = await sync();
    expect(r).toEqual({ added: 2, updated: 0, removed: 0 });
    const items = await emails();
    expect(items.map((i) => i.title).sort()).toEqual(["(no subject)", "Renew passport"]);

    const passport = items.find((i) => i.title === "Renew passport")!;
    expect(passport).toMatchObject({ kind: "email", status: "unread", sourceRef: "gmail:m1", workspaceId: null });
    expect(passport.body).toBe("Your passport expires & you'll need…"); // Gmail's HTML escapes undone
    const meta = JSON.parse(passport.sourceMeta!);
    expect(meta.from).toBe("Gov <noreply@gov.example>");
    expect(meta.url).toBe("https://mail.google.com/mail/?authuser=cam%40gmail.com#all/m1");

    expect(await sync()).toEqual({ added: 0, updated: 0, removed: 0 });
    expect(await emails()).toHaveLength(2);
    expect((await row()).settings).toContain("Label_9");
  });

  it("a dismissed email never comes back", async () => {
    await sync();
    const passport = (await emails()).find((i) => i.title === "Renew passport")!;
    await incoming.triageIncoming(db, { userId: ownerId }, passport.id, { target: "dismiss" });
    await sync();
    const again = (await emails()).filter((i) => i.sourceRef === "gmail:m1");
    expect(again).toHaveLength(1);
    expect(again[0]!.status).toBe("dismissed");
  });

  it("overlapping syncs (scheduler + Sync now) don't duplicate", async () => {
    const [a, b] = await Promise.all([sync(), sync()]);
    expect((a?.added ?? 0) + (b?.added ?? 0)).toBe(2);
    expect(await emails()).toHaveLength(2);
  });

  it("explains a missing STOMP label instead of silently doing nothing", async () => {
    labels = labels.filter((l) => l.name !== "STOMP");
    expect(await sync()).toBeNull();
    expect((await row()).lastError).toMatch(/No Gmail label named “STOMP”/);
    expect(await emails()).toHaveLength(0);
  });

  it("a Google error mid-run writes nothing", async () => {
    failMessage = "m2";
    expect(await sync()).toBeNull();
    expect(await emails()).toHaveLength(0);
    expect((await row()).lastError).toMatch(/Backend Error/);
  });

  it("triaging an email to a todo records source=email and keeps a link back", async () => {
    await sync();
    const passport = (await emails()).find((i) => i.title === "Renew passport")!;
    const res = await app.inject({
      method: "POST",
      url: `/api/incoming-items/${passport.id}/triage`,
      payload: { target: "todo", title: "Renew passport", notes: "before March" },
    });
    expect(res.statusCode).toBeLessThan(300);
    const [item] = await db.select().from(incomingItems).where(eq(incomingItems.id, passport.id));
    const [todo] = await db.select().from(todos).where(eq(todos.id, item!.linkedEntityId!));
    expect(todo!.source).toBe("email");
    expect(todo!.notes).toBe("before March\n\nEmail: https://mail.google.com/mail/?authuser=cam%40gmail.com#all/m1");
  });
});

describe("share notices are not affected by the email dedupe index", () => {
  it("re-sharing after a decline gives the recipient a fresh notice", async () => {
    const sam = (await db.select().from(users).where(eq(users.email, "sam@stomp.local")))[0]!;
    const todo = (await app.inject({ method: "POST", url: "/api/todos", payload: { title: "share me twice" } })).json();
    await collab.addCollaborator(db, { userId: ownerId }, "todo", todo.id, { email: "sam@stomp.local", role: "viewer" });
    const notice = (
      await db.select().from(incomingItems).where(and(eq(incomingItems.forUserId, sam.id), eq(incomingItems.sourceRef, `todo:${todo.id}`)))
    )[0]!;
    await incoming.triageIncoming(db, { userId: sam.id }, notice.id, { target: "decline" });

    await collab.addCollaborator(db, { userId: ownerId }, "todo", todo.id, { email: "sam@stomp.local", role: "viewer" });
    const notices = await db
      .select()
      .from(incomingItems)
      .where(and(eq(incomingItems.forUserId, sam.id), eq(incomingItems.sourceRef, `todo:${todo.id}`)));
    expect(notices).toHaveLength(2);
  });
});
