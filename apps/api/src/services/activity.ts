import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { activityLog, users } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { newId } from "../lib/ids.js";
import type { Ctx } from "./access.js";

type EntityType = "todo" | "event" | "reference" | "project" | "incoming_item" | "workspace";
type Action = "created" | "updated" | "deleted" | "shared" | "completed" | "triaged" | "synced";

export async function logActivity(
  db: Db,
  actorId: string | null,
  entityType: EntityType,
  entityId: string,
  action: Action,
  changes?: Record<string, [unknown, unknown]>,
): Promise<void> {
  await db.insert(activityLog).values({
    id: newId(),
    actorId,
    entityType,
    entityId,
    action,
    changes: changes ? JSON.stringify(changes) : null,
    createdAt: clock.now(),
  });
}

export interface ActivityEntry {
  id: string;
  action: Action;
  actor: string | null;
  createdAt: number;
}

/**
 * Recent activity for one entity. Phase 0/1: no per-entity access check here beyond
 * the caller already having loaded the entity through a visibility-guarded service.
 */
export async function listActivity(
  db: Db,
  _ctx: Ctx,
  entityType: EntityType,
  entityId: string,
  limit = 20,
): Promise<ActivityEntry[]> {
  const rows = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      createdAt: activityLog.createdAt,
      actor: users.displayName,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.actorId))
    .where(and(eq(activityLog.entityType, entityType), eq(activityLog.entityId, entityId)))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
  return rows.map((r) => ({ id: r.id, action: r.action, actor: r.actor ?? null, createdAt: r.createdAt }));
}
