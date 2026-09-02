import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Conventions (ADR-0002):
 *  - text PKs (uuid), generated in app code
 *  - booleans  -> integer 0/1  (mode: "boolean")
 *  - timestamps -> integer epoch ms, UTC  (mode: "number"), named *_at
 *  - enums -> text + { enum: [...] }
 */
const ts = (name: string) => integer(name, { mode: "number" });
const bool = (name: string) => integer(name, { mode: "boolean" });
const now = sql`(cast(strftime('%s','now') as integer) * 1000)`;

// ─────────────────────────────────────── workspaces

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  color: text("color"),
  createdBy: text("created_by").notNull().references(() => users.id),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  createdAt: ts("created_at").notNull().default(now),
  updatedAt: ts("updated_at").notNull().default(now),
});

export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "editor", "viewer"] }).notNull().default("editor"),
    addedBy: text("added_by").notNull().references(() => users.id),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => ({
    uniq: unique().on(t.workspaceId, t.userId),
    byUser: index("idx_ws_members_user").on(t.userId),
  }),
);

// ─────────────────────────────────────── users

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: ts("created_at").notNull().default(now),
  updatedAt: ts("updated_at").notNull().default(now),
  // reserved for auth (Phase 3)
  passwordHash: text("password_hash"),
  authProvider: text("auth_provider"),
  authProviderId: text("auth_provider_id"),
  lastLoginAt: ts("last_login_at"),
});

// ─────────────────────────────────────── projects

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    ownerId: text("owner_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"),
    status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
    createdAt: ts("created_at").notNull().default(now),
    updatedAt: ts("updated_at").notNull().default(now),
  },
  (t) => ({
    byWorkspace: index("idx_projects_workspace").on(t.workspaceId),
    byOwner: index("idx_projects_owner").on(t.ownerId),
  }),
);

export const projectMembers = sqliteTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "editor", "viewer"] }).notNull().default("editor"),
    addedBy: text("added_by").notNull().references(() => users.id),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => ({
    uniq: unique().on(t.projectId, t.userId),
    byUser: index("idx_project_members_user").on(t.userId),
  }),
);

// ─────────────────────────────────────── todos

export const todos = sqliteTable(
  "todos",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    notes: text("notes"),
    status: text("status", {
      enum: ["open", "in_progress", "blocked", "done", "cancelled"],
    }).notNull().default("open"),
    priority: text("priority", {
      enum: ["none", "low", "medium", "high", "urgent"],
    }).notNull().default("none"),
    dueAt: ts("due_at"),
    scheduledFor: ts("scheduled_for"),
    completedAt: ts("completed_at"),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    parentTodoId: text("parent_todo_id"),
    createdBy: text("created_by").notNull().references(() => users.id),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    source: text("source", { enum: ["manual", "inbox", "email", "import"] }).notNull().default("manual"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: ts("created_at").notNull().default(now),
    updatedAt: ts("updated_at").notNull().default(now),
  },
  (t) => ({
    byStatus: index("idx_todos_status").on(t.status),
    byAssignee: index("idx_todos_assignee_status").on(t.assigneeId, t.status),
    byProject: index("idx_todos_project").on(t.projectId),
    byWorkspace: index("idx_todos_workspace").on(t.workspaceId),
    byDue: index("idx_todos_due").on(t.dueAt),
    byScheduled: index("idx_todos_scheduled").on(t.scheduledFor),
    byParent: index("idx_todos_parent").on(t.parentTodoId),
  }),
);

export const todoCollaborators = sqliteTable(
  "todo_collaborators",
  {
    id: text("id").primaryKey(),
    todoId: text("todo_id").notNull().references(() => todos.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["editor", "viewer"] }).notNull().default("viewer"),
    addedBy: text("added_by").notNull().references(() => users.id),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => ({
    uniq: unique().on(t.todoId, t.userId),
    byUser: index("idx_todo_collab_user").on(t.userId),
  }),
);

// ─────────────────────────────────────── events

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    allDay: bool("all_day").notNull().default(false),
    timezone: text("timezone").notNull().default("UTC"),
    rrule: text("rrule"),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    createdBy: text("created_by").notNull().references(() => users.id),
    status: text("status", { enum: ["confirmed", "tentative", "cancelled"] }).notNull().default("confirmed"),
    externalProvider: text("external_provider", { enum: ["google", "outlook", "ics"] }),
    externalId: text("external_id"),
    externalEtag: text("external_etag"),
    lastSyncedAt: ts("last_synced_at"),
    createdAt: ts("created_at").notNull().default(now),
    updatedAt: ts("updated_at").notNull().default(now),
  },
  (t) => ({
    byStarts: index("idx_events_starts").on(t.startsAt),
    byProject: index("idx_events_project").on(t.projectId),
    byWorkspace: index("idx_events_workspace").on(t.workspaceId),
    byExternal: index("idx_events_external").on(t.externalProvider, t.externalId),
  }),
);

export const eventAttendees = sqliteTable(
  "event_attendees",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email"),
    response: text("response", {
      enum: ["needs_action", "accepted", "declined", "tentative"],
    }).notNull().default("needs_action"),
    isOrganizer: bool("is_organizer").notNull().default(false),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => ({ byEvent: index("idx_event_attendees_event").on(t.eventId) }),
);

export const eventCollaborators = sqliteTable(
  "event_collaborators",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["editor", "viewer"] }).notNull().default("viewer"),
    addedBy: text("added_by").notNull().references(() => users.id),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => ({
    uniq: unique().on(t.eventId, t.userId),
    byUser: index("idx_event_collab_user").on(t.userId),
  }),
);

// ─────────────────────────────────────── references (learn library)

export const references = sqliteTable(
  "references",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    description: text("description"),
    status: text("status", {
      enum: ["to_learn", "learning", "learned", "archived"],
    }).notNull().default("to_learn"),
    favorite: bool("favorite").notNull().default(false),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    addedBy: text("added_by").notNull().references(() => users.id),
    lastOpenedAt: ts("last_opened_at"),
    createdAt: ts("created_at").notNull().default(now),
    updatedAt: ts("updated_at").notNull().default(now),
  },
  (t) => ({
    byStatus: index("idx_refs_status").on(t.status),
    byProject: index("idx_refs_project").on(t.projectId),
    byWorkspace: index("idx_refs_workspace").on(t.workspaceId),
  }),
);

export const referenceCollaborators = sqliteTable(
  "reference_collaborators",
  {
    id: text("id").primaryKey(),
    referenceId: text("reference_id").notNull().references(() => references.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["editor", "viewer"] }).notNull().default("viewer"),
    addedBy: text("added_by").notNull().references(() => users.id),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => ({
    uniq: unique().on(t.referenceId, t.userId),
    byUser: index("idx_ref_collab_user").on(t.userId),
  }),
);

// ─────────────────────────────────────── tags

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    // SET NULL like every other workspace-scoped table — deleting a workspace
    // must not destroy its tags (and, via taggings cascade, every association).
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => ({
    // Two partial unique indexes: personal (workspace null) vs workspace-scoped.
    uniqPersonal: uniqueIndex("uq_tags_personal")
      .on(t.ownerId, t.name)
      .where(sql`${t.workspaceId} is null`),
    uniqWorkspace: uniqueIndex("uq_tags_workspace")
      .on(t.workspaceId, t.name)
      .where(sql`${t.workspaceId} is not null`),
  }),
);

export const taggings = sqliteTable(
  "taggings",
  {
    id: text("id").primaryKey(),
    tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
    entityType: text("entity_type", { enum: ["todo", "event", "reference", "project"] }).notNull(),
    entityId: text("entity_id").notNull(),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => ({
    uniq: unique().on(t.tagId, t.entityType, t.entityId),
    byEntity: index("idx_taggings_entity").on(t.entityType, t.entityId),
  }),
);

// ─────────────────────────────────────── incoming items

export const incomingItems = sqliteTable(
  "incoming_items",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body"),
    kind: text("kind", {
      enum: ["capture", "email", "shared_task", "shared_event", "system"],
    }).notNull().default("capture"),
    status: text("status", { enum: ["unread", "triaged", "dismissed"] }).notNull().default("unread"),
    forUserId: text("for_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    sourceRef: text("source_ref"),
    sourceMeta: text("source_meta"),
    linkedEntityType: text("linked_entity_type", { enum: ["todo", "event"] }),
    linkedEntityId: text("linked_entity_id"),
    createdAt: ts("created_at").notNull().default(now),
    triagedAt: ts("triaged_at"),
  },
  (t) => ({ byInbox: index("idx_incoming_inbox").on(t.forUserId, t.status) }),
);

// ─────────────────────────────────────── notifications (reserved — Phase 2+)

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["share_invite", "assignment", "event_reminder", "past_due", "needs_attention", "mention", "system"],
    }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    entityType: text("entity_type", { enum: ["todo", "event", "project", "incoming_item", "workspace"] }),
    entityId: text("entity_id"),
    deliverAt: ts("deliver_at"),
    readAt: ts("read_at"),
    dismissedAt: ts("dismissed_at"),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => ({
    byUser: index("idx_notifications_user").on(t.userId, t.readAt),
    byDeliver: index("idx_notifications_deliver").on(t.deliverAt),
  }),
);

// ─────────────────────────────────────── integrations (reserved — Phase 4/5)

export const integrationAccounts = sqliteTable(
  "integration_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["gmail", "google_calendar", "outlook", "imap"] }).notNull(),
    email: text("email").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: ts("token_expires_at"),
    scopes: text("scopes"),
    status: text("status", { enum: ["connected", "needs_reauth", "disconnected"] }).notNull().default("connected"),
    syncCursor: text("sync_cursor"),
    lastSyncAt: ts("last_sync_at"),
    createdAt: ts("created_at").notNull().default(now),
    updatedAt: ts("updated_at").notNull().default(now),
  },
  (t) => ({ uniq: unique().on(t.userId, t.provider, t.email) }),
);

export const syncLog = sqliteTable("sync_log", {
  id: text("id").primaryKey(),
  integrationAccountId: text("integration_account_id")
    .notNull()
    .references(() => integrationAccounts.id, { onDelete: "cascade" }),
  direction: text("direction", { enum: ["pull", "push"] }).notNull(),
  entityType: text("entity_type", { enum: ["email", "event"] }).notNull(),
  summary: text("summary").notNull(),
  error: text("error"),
  startedAt: ts("started_at").notNull().default(now),
  finishedAt: ts("finished_at"),
});

// ─────────────────────────────────────── activity log

export const activityLog = sqliteTable(
  "activity_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    entityType: text("entity_type", {
      enum: ["todo", "event", "reference", "project", "incoming_item", "workspace"],
    }).notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action", {
      enum: ["created", "updated", "deleted", "shared", "completed", "triaged", "synced"],
    }).notNull(),
    changes: text("changes"),
    createdAt: ts("created_at").notNull().default(now),
  },
  (t) => ({
    byEntity: index("idx_activity_entity").on(t.entityType, t.entityId),
    byCreated: index("idx_activity_created").on(t.createdAt),
  }),
);
