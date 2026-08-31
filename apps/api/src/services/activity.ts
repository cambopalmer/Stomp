import type { Db } from "../db/client.js";
import { activityLog } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { newId } from "../lib/ids.js";

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
