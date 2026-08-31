import type { ApplyTag, CreateTag, Tag } from "@stomp/shared";
import { and, eq, or } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { taggings, tags } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { Conflict } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import type { Ctx } from "./access.js";

export async function listTags(db: Db, ctx: Ctx): Promise<Tag[]> {
  return db.select().from(tags).where(eq(tags.ownerId, ctx.userId)).orderBy(tags.name);
}

export async function createTag(db: Db, ctx: Ctx, input: CreateTag): Promise<Tag> {
  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.ownerId, ctx.userId), eq(tags.name, input.name)))
    .limit(1);
  if (existing[0]) return existing[0];

  const row = {
    id: newId(),
    workspaceId: input.workspaceId ?? null,
    ownerId: ctx.userId,
    name: input.name,
    color: input.color ?? null,
    createdAt: clock.now(),
  };
  await db.insert(tags).values(row);
  return row;
}

export async function applyTag(db: Db, ctx: Ctx, input: ApplyTag) {
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, input.tagId), eq(tags.ownerId, ctx.userId)))
    .limit(1);
  if (!tag) throw Conflict("Unknown tag");
  await db
    .insert(taggings)
    .values({
      id: newId(),
      tagId: input.tagId,
      entityType: input.entityType,
      entityId: input.entityId,
      createdAt: clock.now(),
    })
    .onConflictDoNothing();
  return { ok: true };
}

export async function removeTag(db: Db, ctx: Ctx, input: ApplyTag) {
  const [tag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.id, input.tagId), eq(tags.ownerId, ctx.userId)))
    .limit(1);
  if (!tag) return { ok: true };
  await db
    .delete(taggings)
    .where(
      and(
        eq(taggings.tagId, input.tagId),
        eq(taggings.entityType, input.entityType),
        eq(taggings.entityId, input.entityId),
      ),
    );
  return { ok: true };
}
