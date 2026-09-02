import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { incomingItems, notifications, taggings } from "../db/schema.js";

type Polymorphic = "todo" | "event" | "reference" | "project";

/**
 * Hard delete leaves no FK to clean the polymorphic tables (taggings, and the
 * notification / incoming-item back-references). Call this in every delete
 * service right before/after removing the row.
 */
export async function purgePolymorphicRefs(db: Db, type: Polymorphic, id: string): Promise<void> {
  await db
    .delete(taggings)
    .where(and(eq(taggings.entityType, type), eq(taggings.entityId, id)));

  if (type === "todo" || type === "event") {
    // detach — keep the notification/inbox row but drop the dangling link
    await db
      .update(notifications)
      .set({ entityType: null, entityId: null })
      .where(and(eq(notifications.entityType, type), eq(notifications.entityId, id)));
    await db
      .update(incomingItems)
      .set({ linkedEntityType: null, linkedEntityId: null })
      .where(and(eq(incomingItems.linkedEntityType, type), eq(incomingItems.linkedEntityId, id)));
  }
}
