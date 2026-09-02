import type { CreateReference, Reference, UpdateReference } from "@stomp/shared";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { referenceCollaborators, references } from "../db/schema.js";
import { clock } from "../lib/clock.js";
import { Forbidden, NotFound } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { accessibleProjectIds, assertWorkspaceMember, type Ctx, projectAccess } from "./access.js";
import { logActivity } from "./activity.js";
import { purgePolymorphicRefs } from "./cleanup.js";

async function visible(db: Db, userId: string) {
  const projIds = await accessibleProjectIds(db, userId);
  const collab = await db
    .select({ id: referenceCollaborators.referenceId })
    .from(referenceCollaborators)
    .where(eq(referenceCollaborators.userId, userId));
  const collabIds = collab.map((c) => c.id);
  return or(
    eq(references.addedBy, userId),
    projIds.length ? inArray(references.projectId, projIds) : sql`0`,
    collabIds.length ? inArray(references.id, collabIds) : sql`0`,
  );
}

export async function listReferences(
  db: Db,
  ctx: Ctx,
  filter: { status?: string; workspaceId?: string | null } = {},
): Promise<Reference[]> {
  const conds = [await visible(db, ctx.userId)];
  if (filter.status) conds.push(eq(references.status, filter.status as Reference["status"]));
  if (filter.workspaceId === null) conds.push(isNull(references.workspaceId));
  else if (filter.workspaceId) conds.push(eq(references.workspaceId, filter.workspaceId));
  return db
    .select()
    .from(references)
    .where(and(...conds))
    .orderBy(desc(references.favorite), desc(references.createdAt));
}

export async function getReference(db: Db, ctx: Ctx, id: string): Promise<Reference> {
  const [row] = await db
    .select()
    .from(references)
    .where(and(eq(references.id, id), await visible(db, ctx.userId)))
    .limit(1);
  if (!row) throw NotFound("Reference");
  return row;
}

export async function createReference(db: Db, ctx: Ctx, input: CreateReference): Promise<Reference> {
  if (input.projectId) {
    const a = await projectAccess(db, ctx.userId, input.projectId);
    if (!a.canEdit) throw Forbidden("You can't add references to that project");
  }
  await assertWorkspaceMember(db, ctx.userId, input.workspaceId);
  const ts = clock.now();
  const row = {
    id: newId(),
    workspaceId: input.workspaceId ?? null,
    title: input.title,
    url: input.url,
    description: input.description ?? null,
    status: input.status ?? ("to_learn" as const),
    favorite: input.favorite ?? false,
    projectId: input.projectId ?? null,
    addedBy: ctx.userId,
    lastOpenedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(references).values(row);
  await logActivity(db, ctx.userId, "reference", row.id, "created");
  return row;
}

export async function updateReference(db: Db, ctx: Ctx, id: string, input: UpdateReference): Promise<Reference> {
  const current = await getReference(db, ctx, id);
  if (current.addedBy !== ctx.userId) {
    const a = current.projectId ? await projectAccess(db, ctx.userId, current.projectId) : { canEdit: false };
    if (!a.canEdit) throw Forbidden("You can't edit this reference");
  }
  const patch: Partial<Reference> = { updatedAt: clock.now() };
  for (const f of ["title", "url", "description", "status", "favorite", "projectId", "lastOpenedAt"] as const) {
    if (input[f] !== undefined) (patch as Record<string, unknown>)[f] = input[f];
  }
  await db.update(references).set(patch).where(eq(references.id, id));
  await logActivity(db, ctx.userId, "reference", id, "updated");
  return { ...current, ...patch } as Reference;
}

export async function deleteReference(db: Db, ctx: Ctx, id: string): Promise<void> {
  const current = await getReference(db, ctx, id);
  if (current.addedBy !== ctx.userId) throw Forbidden("Only the creator can delete this reference");
  await purgePolymorphicRefs(db, "reference", id);
  await db.delete(references).where(eq(references.id, id));
  await logActivity(db, ctx.userId, "reference", id, "deleted");
}
