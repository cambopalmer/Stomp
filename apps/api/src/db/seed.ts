import { argv } from "node:process";
import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { config } from "../config.js";
import { newId } from "../lib/ids.js";
import { hashPassword } from "../services/auth.js";
import { client, db } from "./client.js";
import { runMigrations } from "./migrate.js";
import * as t from "./schema.js";

const DAY = 86_400_000;

export async function seed(): Promise<void> {
  await runMigrations();

  // Idempotent: wipe user data (keeps schema).
  for (const table of [
    t.taggings, t.tags, t.activityLog, t.eventAttendees, t.todoCollaborators,
    t.eventCollaborators, t.referenceCollaborators, t.incomingItems, t.notifications,
    t.todos, t.events, t.references, t.projectMembers, t.projects,
    t.workspaceMembers, t.workspaces, t.users,
  ]) {
    await db.delete(table);
  }

  const now = Date.now();
  const todayStart = now - (now % DAY);

  const pwHash = await hashPassword(config.SEED_USER_PASSWORD);
  const owner = { id: newId(), email: config.SEED_USER_EMAIL, displayName: "Cam (owner)", timezone: "America/Denver", passwordHash: pwHash, lastLoginAt: now, createdAt: now, updatedAt: now };
  const partner = { id: newId(), email: "sam@stomp.local", displayName: "Sam", timezone: "America/Denver", passwordHash: pwHash, lastLoginAt: now, createdAt: now, updatedAt: now };
  await db.insert(t.users).values([owner, partner]);

  // Shared workspace
  const ws = { id: newId(), name: "Household", slug: "household", description: "Shared plans", color: "#0D9488", createdBy: owner.id, status: "active" as const, createdAt: now, updatedAt: now };
  await db.insert(t.workspaces).values(ws);
  await db.insert(t.workspaceMembers).values([
    { id: newId(), workspaceId: ws.id, userId: owner.id, role: "owner" as const, addedBy: owner.id, createdAt: now },
    { id: newId(), workspaceId: ws.id, userId: partner.id, role: "editor" as const, addedBy: owner.id, createdAt: now },
  ]);

  // Shared project in the workspace
  const trip = { id: newId(), workspaceId: ws.id, ownerId: owner.id, name: "Weekend trip", description: "Planning the getaway", color: "#EA580C", status: "active" as const, createdAt: now, updatedAt: now };
  // Personal project — dogfood this build
  const build = { id: newId(), workspaceId: null, ownerId: owner.id, name: "STOMP Buildout", description: "Building this app", color: "#6366F1", status: "active" as const, createdAt: now, updatedAt: now };
  await db.insert(t.projects).values([trip, build]);
  await db.insert(t.projectMembers).values([
    { id: newId(), projectId: trip.id, userId: owner.id, role: "owner" as const, addedBy: owner.id, createdAt: now },
    { id: newId(), projectId: trip.id, userId: partner.id, role: "editor" as const, addedBy: owner.id, createdAt: now },
    { id: newId(), projectId: build.id, userId: owner.id, role: "owner" as const, addedBy: owner.id, createdAt: now },
  ]);

  const mkTodo = (o: Partial<typeof t.todos.$inferInsert> & { title: string }) => ({
    id: newId(), createdBy: owner.id, status: "open" as const, priority: "none" as const,
    source: "manual" as const, sortOrder: 0, createdAt: now, updatedAt: now,
    workspaceId: null, notes: null, dueAt: null, scheduledFor: null, completedAt: null,
    projectId: null, parentTodoId: null, assigneeId: null, ...o,
  });

  await db.insert(t.todos).values([
    mkTodo({ title: "Fix leaking tap", priority: "high", dueAt: todayStart - DAY }), // overdue
    mkTodo({ title: "Call the vet", priority: "urgent", dueAt: todayStart + DAY / 2 }), // due today
    mkTodo({ title: "Draft trip packing list", projectId: trip.id, workspaceId: ws.id, scheduledFor: todayStart }),
    mkTodo({ title: "Book cabin", projectId: trip.id, workspaceId: ws.id, priority: "high", assigneeId: partner.id }),
    mkTodo({ title: "Wire up CRUD routes", projectId: build.id, status: "done", completedAt: now - DAY }),
    mkTodo({ title: "Build the React shell", projectId: build.id, priority: "medium", scheduledFor: todayStart }),
    mkTodo({ title: "Ship Phase 0", projectId: build.id, priority: "low" }),
  ]);

  await db.insert(t.events).values([
    {
      id: newId(), workspaceId: ws.id, title: "Trip planning call", description: null, location: null,
      startsAt: todayStart + 15 * 3_600_000, endsAt: todayStart + 16 * 3_600_000, allDay: false,
      timezone: owner.timezone, rrule: null, projectId: trip.id, createdBy: owner.id, status: "confirmed",
      externalProvider: null, externalId: null, externalEtag: null, lastSyncedAt: null, createdAt: now, updatedAt: now,
    },
    {
      id: newId(), workspaceId: null, title: "Dentist", description: null, location: "Downtown",
      startsAt: todayStart + 3 * DAY + 9 * 3_600_000, endsAt: todayStart + 3 * DAY + 10 * 3_600_000, allDay: false,
      timezone: owner.timezone, rrule: null, projectId: null, createdBy: owner.id, status: "confirmed",
      externalProvider: null, externalId: null, externalEtag: null, lastSyncedAt: null, createdAt: now, updatedAt: now,
    },
  ]);

  await db.insert(t.references).values([
    { id: newId(), workspaceId: null, title: "Drizzle ORM docs", url: "https://orm.drizzle.team", description: "Schema + queries", status: "learning", favorite: true, projectId: build.id, addedBy: owner.id, lastOpenedAt: null, createdAt: now, updatedAt: now },
    { id: newId(), workspaceId: null, title: "Fastify v5 guide", url: "https://fastify.dev", description: null, status: "to_learn", favorite: false, projectId: build.id, addedBy: owner.id, lastOpenedAt: null, createdAt: now, updatedAt: now },
    { id: newId(), workspaceId: null, title: "WCAG 2.2 quickref", url: "https://www.w3.org/WAI/WCAG22/quickref/", description: "Accessibility", status: "to_learn", favorite: false, projectId: null, addedBy: owner.id, lastOpenedAt: null, createdAt: now, updatedAt: now },
  ]);

  await db.insert(t.incomingItems).values([
    { id: newId(), workspaceId: null, title: "Idea: weekly review ritual", body: "Sit down Sunday evening", kind: "capture", status: "unread", forUserId: owner.id, createdBy: owner.id, projectId: null, sourceRef: null, sourceMeta: null, linkedEntityType: null, linkedEntityId: null, createdAt: now, triagedAt: null },
    { id: newId(), workspaceId: ws.id, title: "Sam: can you confirm the dates?", body: null, kind: "shared_task", status: "unread", forUserId: owner.id, createdBy: partner.id, projectId: trip.id, sourceRef: null, sourceMeta: null, linkedEntityType: null, linkedEntityId: null, createdAt: now, triagedAt: null },
  ]);

  const tag = { id: newId(), workspaceId: null, ownerId: owner.id, name: "reading", color: "#0EA5E9", createdAt: now };
  await db.insert(t.tags).values(tag);
  await db.insert(t.taggings).values({ id: newId(), tagId: tag.id, entityType: "reference", entityId: (await db.select({ id: t.references.id }).from(t.references).limit(1))[0]!.id, createdAt: now });

  const counts = await db.select({ c: sql<number>`count(*)` }).from(t.todos);
  console.log(`Seeded: 2 users, 1 workspace, 2 projects, ${counts[0]?.c ?? 0} todos, events, references, incoming.`);
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  await seed();
  client.close();
}
