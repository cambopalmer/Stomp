import type { ApplyTag, CreateTag, Tag } from "@stomp/shared";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { taggings, tags } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { Conflict, NotFound } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import type { Ctx } from "./access.js";
import { listEvents } from "./events.js";
import { listReferences } from "./references.js";
import { listTodos } from "./todos.js";

export async function listTags(db: Db, ctx: Ctx): Promise<Tag[]> {
  return db.select().from(tags).where(eq(tags.ownerId, ctx.userId)).orderBy(tags.name);
}

/** Tags applied to one entity (owned by the current user). */
export async function tagsForEntity(
  db: Db,
  ctx: Ctx,
  entityType: ApplyTag["entityType"],
  entityId: string,
): Promise<Tag[]> {
  const rows = await db
    .select({ tag: tags })
    .from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .where(
      and(
        eq(taggings.entityType, entityType),
        eq(taggings.entityId, entityId),
        eq(tags.ownerId, ctx.userId),
      ),
    );
  return rows.map((r) => r.tag);
}

/** Everything visible to the user carrying a given tag (by tag id). */
export async function tagItems(db: Db, ctx: Ctx, tagId: string) {
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.ownerId, ctx.userId)))
    .limit(1);
  if (!tag) throw NotFound("Tag");

  const links = await db.select().from(taggings).where(eq(taggings.tagId, tagId));
  const idsOf = (t: string) => links.filter((l) => l.entityType === t).map((l) => l.entityId);

  const [allTodos, allEvents, allRefs] = await Promise.all([
    listTodos(db, ctx),
    listEvents(db, ctx),
    listReferences(db, ctx),
  ]);
  const inSet = (ids: string[]) => new Set(ids);
  const tset = inSet(idsOf("todo"));
  const eset = inSet(idsOf("event"));
  const rset = inSet(idsOf("reference"));

  return {
    tag,
    todos: allTodos.filter((x) => tset.has(x.id)),
    events: allEvents.filter((x) => eset.has(x.id)),
    references: allRefs.filter((x) => rset.has(x.id)),
  };
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
