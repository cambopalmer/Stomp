import type { CalendarEvent, CreateEvent, UpdateEvent } from "@stomp/shared";
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { eventCollaborators, events } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { Forbidden, NotFound } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { accessibleProjectIds, assertWorkspaceMember, type Ctx, projectAccess } from "./access.js";
import { logActivity } from "./activity.js";
import { purgePolymorphicRefs } from "./cleanup.js";

/** SQL condition: events visible to `userId` (creator, accessible project, or collaborator). */
export async function visibleEventsCond(db: Db, userId: string) {
  const projIds = await accessibleProjectIds(db, userId);
  const collab = await db
    .select({ id: eventCollaborators.eventId })
    .from(eventCollaborators)
    .where(eq(eventCollaborators.userId, userId));
  const collabIds = collab.map((c) => c.id);
  return or(
    eq(events.createdBy, userId),
    projIds.length ? inArray(events.projectId, projIds) : sql`0`,
    collabIds.length ? inArray(events.id, collabIds) : sql`0`,
  );
}
const visible = visibleEventsCond;

export async function listEvents(
  db: Db,
  ctx: Ctx,
  range?: { from?: number; to?: number; workspaceId?: string | null },
): Promise<CalendarEvent[]> {
  const conds = [await visible(db, ctx.userId)];
  if (range?.from) conds.push(gte(events.endsAt, range.from));
  if (range?.to) conds.push(lte(events.startsAt, range.to));
  if (range?.workspaceId === null) conds.push(isNull(events.workspaceId));
  else if (range?.workspaceId) conds.push(eq(events.workspaceId, range.workspaceId));
  return db
    .select()
    .from(events)
    .where(and(...conds))
    .orderBy(asc(events.startsAt));
}

export async function getEvent(db: Db, ctx: Ctx, id: string): Promise<CalendarEvent> {
  const [row] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), await visible(db, ctx.userId)))
    .limit(1);
  if (!row) throw NotFound("Event");
  return row;
}

export async function createEvent(db: Db, ctx: Ctx, input: CreateEvent): Promise<CalendarEvent> {
  if (input.projectId) {
    const a = await projectAccess(db, ctx.userId, input.projectId);
    if (!a.canEdit) throw Forbidden("You can't add events to that project");
  }
  await assertWorkspaceMember(db, ctx.userId, input.workspaceId);
  const ts = clock.now();
  const row = {
    id: newId(),
    workspaceId: input.workspaceId ?? null,
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: input.allDay ?? false,
    timezone: input.timezone ?? "UTC",
    rrule: null,
    projectId: input.projectId ?? null,
    createdBy: ctx.userId,
    status: "confirmed" as const,
    externalProvider: null,
    externalId: null,
    externalEtag: null,
    lastSyncedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(events).values(row);
  await logActivity(db, ctx.userId, "event", row.id, "created");
  return row;
}

export async function updateEvent(db: Db, ctx: Ctx, id: string, input: UpdateEvent): Promise<CalendarEvent> {
  const current = await getEvent(db, ctx, id);
  if (current.createdBy !== ctx.userId) {
    const a = current.projectId ? await projectAccess(db, ctx.userId, current.projectId) : { canEdit: false };
    if (!a.canEdit) throw Forbidden("You can't edit this event");
  }
  const patch: Partial<CalendarEvent> = { updatedAt: clock.now() };
  for (const f of ["title", "description", "location", "startsAt", "endsAt", "allDay", "timezone", "projectId", "status"] as const) {
    if (input[f] !== undefined) (patch as Record<string, unknown>)[f] = input[f];
  }
  await db.update(events).set(patch).where(eq(events.id, id));
  await logActivity(db, ctx.userId, "event", id, "updated");
  return { ...current, ...patch } as CalendarEvent;
}

export async function deleteEvent(db: Db, ctx: Ctx, id: string): Promise<void> {
  const current = await getEvent(db, ctx, id);
  if (current.createdBy !== ctx.userId) throw Forbidden("Only the creator can delete this event");
  await purgePolymorphicRefs(db, "event", id);
  await db.delete(events).where(eq(events.id, id));
  await logActivity(db, ctx.userId, "event", id, "deleted");
}
