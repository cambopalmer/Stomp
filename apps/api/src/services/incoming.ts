import type { CreateIncoming, IncomingItem, TriageIncoming } from "@stomp/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { incomingItems } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { NotFound } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import type { Ctx } from "./access.js";
import { logActivity } from "./activity.js";
import { leaveShare } from "./collaborators.js";
import { createEvent } from "./events.js";
import { createTodo } from "./todos.js";

export async function listIncoming(
  db: Db,
  ctx: Ctx,
  opts: { status?: string; workspaceId?: string | null } = {},
): Promise<IncomingItem[]> {
  const conds = [
    eq(incomingItems.forUserId, ctx.userId),
    eq(incomingItems.status, (opts.status ?? "unread") as IncomingItem["status"]),
  ];
  if (opts.workspaceId === null) conds.push(isNull(incomingItems.workspaceId));
  else if (opts.workspaceId) conds.push(eq(incomingItems.workspaceId, opts.workspaceId));
  return db
    .select()
    .from(incomingItems)
    .where(and(...conds))
    .orderBy(desc(incomingItems.createdAt));
}

export async function createIncoming(db: Db, ctx: Ctx, input: CreateIncoming): Promise<IncomingItem> {
  const row = {
    id: newId(),
    workspaceId: input.workspaceId ?? null,
    title: input.title,
    body: input.body ?? null,
    kind: "capture" as const,
    status: "unread" as const,
    forUserId: ctx.userId,
    createdBy: ctx.userId,
    projectId: input.projectId ?? null,
    sourceRef: null,
    sourceMeta: null,
    linkedEntityType: null,
    linkedEntityId: null,
    createdAt: clock.now(),
    triagedAt: null,
  };
  await db.insert(incomingItems).values(row);
  await logActivity(db, ctx.userId, "incoming_item", row.id, "created");
  return row;
}

export async function triageIncoming(db: Db, ctx: Ctx, id: string, input: TriageIncoming) {
  const [item] = await db
    .select()
    .from(incomingItems)
    .where(and(eq(incomingItems.id, id), eq(incomingItems.forUserId, ctx.userId)))
    .limit(1);
  if (!item) throw NotFound("Incoming item");

  // Accept / decline a shared item (nothing new is created).
  if (input.target === "accept" || input.target === "decline") {
    if (input.target === "decline" && item.linkedEntityType && item.linkedEntityId) {
      await leaveShare(db, ctx, item.linkedEntityType, item.linkedEntityId);
    }
    const status = input.target === "accept" ? "triaged" : "dismissed";
    await db
      .update(incomingItems)
      .set({ status, triagedAt: clock.now() })
      .where(eq(incomingItems.id, id));
    await logActivity(db, ctx.userId, "incoming_item", id, input.target === "accept" ? "triaged" : "deleted");
    return { ...item, status, triagedAt: clock.now() } as IncomingItem;
  }

  let linkedEntityType: "todo" | "event" | null = null;
  let linkedEntityId: string | null = null;

  if (input.target === "todo") {
    const todo = await createTodo(db, ctx, {
      title: input.title,
      notes: input.notes ?? item.body ?? undefined,
      dueAt: input.dueAt ?? undefined,
      scheduledFor: input.scheduledFor ?? undefined,
      projectId: input.projectId ?? item.projectId ?? undefined,
    });
    linkedEntityType = "todo";
    linkedEntityId = todo.id;
  } else if (input.target === "event") {
    const ev = await createEvent(db, ctx, {
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      allDay: input.allDay,
      projectId: input.projectId ?? item.projectId ?? undefined,
    });
    linkedEntityType = "event";
    linkedEntityId = ev.id;
  }

  const status = input.target === "dismiss" ? "dismissed" : "triaged";
  await db
    .update(incomingItems)
    .set({ status, triagedAt: clock.now(), linkedEntityType, linkedEntityId })
    .where(eq(incomingItems.id, id));
  await logActivity(db, ctx.userId, "incoming_item", id, input.target === "dismiss" ? "deleted" : "triaged");

  return { ...item, status, linkedEntityType, linkedEntityId, triagedAt: clock.now() } as IncomingItem;
}
