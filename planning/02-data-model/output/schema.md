# STOMP — Data Model / Schema

**Conventions (from ADR-0002):**
- Text primary keys (`uuid`/`cuid2`), generated in app code.
- Booleans → `integer` 0/1.
- Timestamps → `integer` epoch **milliseconds, UTC**. Named `*_at`.
- Enums → `text` + `CHECK (col IN (...))`.
- `created_at` / `updated_at` on every mutable table; `updated_at` bumped by the repository layer.
- FKs `ON DELETE` behavior stated per relationship. `PRAGMA foreign_keys = ON`.

**Sharing model:** see [ADR-0003](../../_config/decisions/adr-0003-workspaces-and-sharing.md). Summary: nullable `workspace_id` everywhere; personal (`NULL`) items are private to creator + explicit grants; workspace visibility flows through projects; per-type collaborator tables for item-level shares.

---

## 1. Entity overview (text ERD)

```
workspaces ──< workspace_members >── users
    │                                  │
    │ (nullable workspace_id on:)      │
    ├─ projects ──< project_members >──┤   (project_members = personal-project shares
    ├─ todos                           │    + cross-workspace guests)
    ├─ events ──< event_attendees >────┤
    ├─ references                      │
    ├─ tags                            │
    └─ incoming_items                  │
                                       │
todos ──< todos (parent_todo_id, self-ref subtasks; inherit workspace+project)
todos: created_by, assignee_id ────────┤
events: created_by ────────────────────┤
references: added_by ──────────────────┤
incoming_items: for_user_id, created_by┤
                                       │
Item-level shares (top-level items only):
  todo_collaborators / event_collaborators / reference_collaborators >── users

tags ──< taggings >── (todo | event | reference | project)      [polymorphic, low risk]
users ──< integration_accounts ──< sync_log                     [reserved]
users ──< notifications                                         [reserved — Phase 2+]
* ──< activity_log                                              [polymorphic, append-only]
```

---

## 2. Tables

### workspaces
| column | type | notes |
|---|---|---|
| id | text PK | |
| name | text | NOT NULL |
| slug | text | UNIQUE, NOT NULL (URL) |
| description | text | null |
| color | text | null |
| created_by | text | FK users, ON DELETE RESTRICT |
| status | text | `'active' \| 'archived'`, default `'active'` |
| created_at / updated_at | integer | |

### workspace_members
| column | type | notes |
|---|---|---|
| id | text PK | |
| workspace_id | text | FK workspaces, ON DELETE CASCADE |
| user_id | text | FK users, ON DELETE CASCADE |
| role | text | `'owner' \| 'admin' \| 'editor' \| 'viewer'`, default `'editor'` |
| added_by | text | FK users |
| created_at | integer | |
| | | UNIQUE(workspace_id, user_id); INDEX(user_id) |

### users
| column | type | notes |
|---|---|---|
| id | text PK | |
| email | text | UNIQUE, NOT NULL |
| display_name | text | NOT NULL |
| avatar_url | text | null |
| timezone | text | NOT NULL, default `'UTC'` (IANA name) |
| created_at / updated_at | integer | |
| **reserved for auth (Phase 3, nullable now):** password_hash, auth_provider, auth_provider_id, last_login_at | | |

### projects
| column | type | notes |
|---|---|---|
| id | text PK | |
| workspace_id | text | **null** = personal project; FK workspaces, ON DELETE SET NULL |
| owner_id | text | FK users, ON DELETE RESTRICT |
| name | text | NOT NULL |
| description | text | null |
| color | text | null |
| status | text | `'active' \| 'archived'`, default `'active'` |
| created_at / updated_at | integer | INDEX(workspace_id) |

### project_members
Grants access to a **personal** project, or gives a **cross-workspace guest** access to a workspace project, or bumps a workspace member's role on one project.
| column | type | notes |
|---|---|---|
| id | text PK | |
| project_id | text | FK projects, ON DELETE CASCADE |
| user_id | text | FK users, ON DELETE CASCADE |
| role | text | `'owner' \| 'editor' \| 'viewer'`, default `'editor'` |
| added_by | text | FK users |
| created_at | integer | |
| | | UNIQUE(project_id, user_id); INDEX(user_id) |

### todos
| column | type | notes |
|---|---|---|
| id | text PK | |
| workspace_id | text | null; FK workspaces, ON DELETE SET NULL. Subtasks inherit parent's value. |
| title | text | NOT NULL |
| notes | text | null (markdown) |
| status | text | `'open' \| 'in_progress' \| 'blocked' \| 'done' \| 'cancelled'`, default `'open'` |
| priority | text | `'none' \| 'low' \| 'medium' \| 'high' \| 'urgent'`, default `'none'` |
| due_at | integer | null — the deadline |
| scheduled_for | integer | null — start of day (UTC ms) the user plans to work it; drives "today" |
| completed_at | integer | null |
| project_id | text | null, FK projects, ON DELETE SET NULL. Subtasks inherit parent's value. |
| parent_todo_id | text | null, FK todos, ON DELETE CASCADE (subtasks) |
| created_by | text | FK users, ON DELETE RESTRICT |
| assignee_id | text | null, FK users, ON DELETE SET NULL |
| source | text | `'manual' \| 'inbox' \| 'email' \| 'import'`, default `'manual'` |
| sort_order | integer | NOT NULL, default 0 |
| created_at / updated_at | integer | |

### events
| column | type | notes |
|---|---|---|
| id | text PK | |
| workspace_id | text | null; FK workspaces, ON DELETE SET NULL |
| title | text | NOT NULL |
| description / location | text | null |
| starts_at / ends_at | integer | NOT NULL |
| all_day | integer | 0/1, default 0 |
| timezone | text | NOT NULL — IANA name |
| rrule | text | null — RFC 5545 recurrence (reserved; not expanded in v1 — see §7) |
| project_id | text | null, FK projects, ON DELETE SET NULL |
| created_by | text | FK users, ON DELETE RESTRICT |
| status | text | `'confirmed' \| 'tentative' \| 'cancelled'`, default `'confirmed'` |
| **reserved for sync (Phase 4):** external_provider, external_id, external_etag, last_synced_at | | INDEX(external_provider, external_id) |
| created_at / updated_at | integer | |

### event_attendees
| column | type | notes |
|---|---|---|
| id | text PK | |
| event_id | text | FK events, ON DELETE CASCADE |
| user_id | text | null, FK users, ON DELETE CASCADE (internal) |
| email | text | null (external) |
| response | text | `'needs_action' \| 'accepted' \| 'declined' \| 'tentative'`, default `'needs_action'` |
| is_organizer | integer | 0/1, default 0 |
| created_at | integer | CHECK(user_id IS NOT NULL OR email IS NOT NULL) |

### references
| column | type | notes |
|---|---|---|
| id | text PK | |
| workspace_id | text | null; FK workspaces, ON DELETE SET NULL |
| title | text | NOT NULL |
| url | text | NOT NULL |
| description | text | null |
| status | text | `'to_learn' \| 'learning' \| 'learned' \| 'archived'`, default `'to_learn'` |
| favorite | integer | 0/1, default 0 |
| project_id | text | null, FK projects, ON DELETE SET NULL |
| added_by | text | FK users, ON DELETE RESTRICT |
| last_opened_at | integer | null |
| created_at / updated_at | integer | |
| **reserved (backlog):** rating, revisit_at, progress_pct, topic_id | | |

### tags
| column | type | notes |
|---|---|---|
| id | text PK | |
| workspace_id | text | null = personal tag; FK workspaces, ON DELETE CASCADE |
| owner_id | text | FK users, ON DELETE CASCADE |
| name | text | NOT NULL |
| color | text | null |
| created_at | integer | |
| | | partial UNIQUE(owner_id, name) WHERE workspace_id IS NULL; partial UNIQUE(workspace_id, name) WHERE workspace_id IS NOT NULL |

### taggings
Polymorphic. Low integrity risk, high convenience.
| column | type | notes |
|---|---|---|
| id | text PK | |
| tag_id | text | FK tags, ON DELETE CASCADE |
| entity_type | text | `'todo' \| 'event' \| 'reference' \| 'project'` |
| entity_id | text | (no FK) |
| created_at | integer | UNIQUE(tag_id, entity_type, entity_id); INDEX(entity_type, entity_id) |

### incoming_items
| column | type | notes |
|---|---|---|
| id | text PK | |
| workspace_id | text | null; FK workspaces, ON DELETE SET NULL |
| title | text | NOT NULL |
| body | text | null |
| kind | text | `'capture' \| 'email' \| 'shared_task' \| 'shared_event' \| 'system'` |
| status | text | `'unread' \| 'triaged' \| 'dismissed'`, default `'unread'` |
| for_user_id | text | FK users, ON DELETE CASCADE — whose inbox |
| created_by | text | null, FK users, ON DELETE SET NULL |
| project_id | text | null, FK projects, ON DELETE SET NULL |
| source_ref | text | null — e.g. Gmail message id |
| source_meta | text | null — JSON |
| linked_entity_type / linked_entity_id | text | null — set on triage |
| created_at | integer | |
| triaged_at | integer | null |
| | | INDEX(for_user_id, status) |

### notifications  *(reserved — no producers in Phase 0; Phase 2+)*
Home for accept/decline prompts, upcoming-event reminders, past-due / needs-attention alerts.
| column | type | notes |
|---|---|---|
| id | text PK | |
| user_id | text | FK users, ON DELETE CASCADE — recipient |
| type | text | `'share_invite' \| 'assignment' \| 'event_reminder' \| 'past_due' \| 'needs_attention' \| 'mention' \| 'system'` |
| title | text | NOT NULL |
| body | text | null |
| entity_type | text | null — `'todo' \| 'event' \| 'project' \| 'incoming_item' \| 'workspace'` |
| entity_id | text | null |
| deliver_at | integer | null — for scheduled reminders; null = immediate |
| read_at | integer | null |
| dismissed_at | integer | null |
| created_at | integer | INDEX(user_id, read_at); INDEX(deliver_at) |

### integration_accounts  *(reserved — designed, no live code in v1)*
`(id, user_id FK, provider 'gmail'|'google_calendar'|'outlook'|'imap', email, access_token enc, refresh_token enc, token_expires_at, scopes, status 'connected'|'needs_reauth'|'disconnected', sync_cursor, last_sync_at, created_at, updated_at)` — UNIQUE(user_id, provider, email). See [integrations.md](../../04-integrations/output/integrations.md).

### sync_log  *(reserved)*
`(id, integration_account_id FK CASCADE, direction 'pull'|'push', entity_type 'email'|'event', summary, error, started_at, finished_at)`

### activity_log
Append-only. Powers change history + audit.
| column | type | notes |
|---|---|---|
| id | text PK | |
| actor_id | text | null, FK users, ON DELETE SET NULL |
| entity_type | text | `'todo' \| 'event' \| 'reference' \| 'project' \| 'incoming_item' \| 'workspace'` |
| entity_id | text | |
| action | text | `'created' \| 'updated' \| 'deleted' \| 'shared' \| 'completed' \| 'triaged' \| 'synced'` |
| changes | text | null — JSON diff `{field: [old, new]}` |
| created_at | integer | INDEX(entity_type, entity_id), INDEX(created_at) |

---

## 3. Visibility & permissions (implements [ADR-0003](../../_config/decisions/adr-0003-workspaces-and-sharing.md))

Implemented in `apps/api/src/repositories/visibility.ts`. Every list/read composes these.

**`accessibleProjectIds(U)`** =
- projects where `owner_id = U`
- ∪ projects where `id ∈ project_members(user_id = U)`
- ∪ projects where `workspace_id ∈ workspaceIds(U)`   (`workspaceIds(U)` = `workspace_members.workspace_id` for U)

**A todo is visible to U** if any:
1. `created_by = U`
2. `assignee_id = U`
3. `project_id ∈ accessibleProjectIds(U)`
4. `id ∈ todo_collaborators(user_id = U)`  *(top-level todos only; subtasks follow their parent)*

Events & references: same, minus rule 2; events also visible if `id ∈ event_attendees(user_id = U)`.

**Edit** requires:
- creator/owner, OR
- effective project role ≥ `editor` (stronger of `workspace_members.role` and `project_members.role`), OR
- collaborator role = `editor`, OR
- assignee (limited: `status`, `completed_at`, `scheduled_for` only).

**Subtask enforcement (service layer):** on create, copy parent's `workspace_id` + `project_id`; reject explicit overrides. On parent re-scope, cascade to children in a transaction. Reject collaborator rows targeting a subtask.

---

## 4. Indexes

```sql
CREATE INDEX idx_ws_members_user       ON workspace_members(user_id);
CREATE INDEX idx_projects_workspace    ON projects(workspace_id);
CREATE INDEX idx_project_members_user  ON project_members(user_id);
CREATE INDEX idx_todos_status          ON todos(status);
CREATE INDEX idx_todos_assignee_status ON todos(assignee_id, status);
CREATE INDEX idx_todos_project         ON todos(project_id);
CREATE INDEX idx_todos_workspace       ON todos(workspace_id);
CREATE INDEX idx_todos_due             ON todos(due_at);
CREATE INDEX idx_todos_scheduled       ON todos(scheduled_for);
CREATE INDEX idx_todos_parent          ON todos(parent_todo_id);
CREATE INDEX idx_events_starts         ON events(starts_at);
CREATE INDEX idx_events_project        ON events(project_id);
CREATE INDEX idx_events_external       ON events(external_provider, external_id);
CREATE INDEX idx_refs_status           ON references(status);
CREATE INDEX idx_refs_project          ON references(project_id);
CREATE INDEX idx_incoming_inbox        ON incoming_items(for_user_id, status);
CREATE INDEX idx_taggings_entity       ON taggings(entity_type, entity_id);
CREATE INDEX idx_notifications_user    ON notifications(user_id, read_at);
CREATE INDEX idx_notifications_deliver ON notifications(deliver_at);
CREATE INDEX idx_activity_entity       ON activity_log(entity_type, entity_id);
```

---

## 5. "Today / hot & relevant sidebar" query

Rule (confirmed): **high-priority open todos + due-today + overdue + un-triaged incoming** (+ today's events for the landing page).

```sql
-- :uid, :dayStart/:dayEnd (user tz → UTC ms), plus pre-resolved :wsIds, :projIds
WITH visible_todos AS (
  SELECT t.* FROM todos t
  WHERE t.status NOT IN ('done','cancelled')
    AND t.parent_todo_id IS NULL           -- sidebar shows top-level items
    AND ( t.created_by = :uid
       OR t.assignee_id = :uid
       OR t.project_id IN (:projIds)        -- = accessibleProjectIds(uid)
       OR t.id IN (SELECT todo_id FROM todo_collaborators WHERE user_id = :uid) )
)
SELECT id, title, priority, due_at, scheduled_for,
  CASE
    WHEN due_at IS NOT NULL AND due_at <  :dayStart THEN 1   -- overdue
    WHEN priority = 'urgent'                        THEN 2
    WHEN due_at BETWEEN :dayStart AND :dayEnd       THEN 3   -- due today
    WHEN priority = 'high'                          THEN 4
    WHEN scheduled_for BETWEEN :dayStart AND :dayEnd THEN 5  -- planned today
    ELSE 9
  END AS bucket
FROM visible_todos
WHERE (due_at IS NOT NULL AND due_at < :dayEnd)
   OR priority IN ('high','urgent')
   OR (scheduled_for BETWEEN :dayStart AND :dayEnd)
ORDER BY bucket, due_at NULLS LAST, priority DESC
LIMIT 50;

-- appended by the API:
SELECT id, title, kind, created_at FROM incoming_items
WHERE for_user_id = :uid AND status = 'unread'
ORDER BY created_at DESC LIMIT 20;

SELECT id, title, starts_at, ends_at, all_day FROM events
WHERE status != 'cancelled'
  AND starts_at < :dayEnd AND ends_at >= :dayStart
  AND ( created_by = :uid
     OR project_id IN (:projIds)
     OR id IN (SELECT event_id FROM event_attendees WHERE user_id = :uid) )
ORDER BY starts_at;
```

---

## 6. Drizzle schema sketch (`apps/api/src/db/schema.ts`)

```ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

const ts = (n: string) => integer(n, { mode: 'number' });   // epoch ms
const bool = (n: string) => integer(n, { mode: 'boolean' });

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  color: text('color'),
  createdBy: text('created_by').notNull().references(() => users.id),
  status: text('status', { enum: ['active','archived'] }).notNull().default('active'),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
});

export const workspaceMembers = sqliteTable('workspace_members', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner','admin','editor','viewer'] }).notNull().default('editor'),
  addedBy: text('added_by').notNull().references(() => users.id),
  createdAt: ts('created_at').notNull(),
}, (t) => ({ byUser: index('idx_ws_members_user').on(t.userId) }));

export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  notes: text('notes'),
  status: text('status', { enum: ['open','in_progress','blocked','done','cancelled'] }).notNull().default('open'),
  priority: text('priority', { enum: ['none','low','medium','high','urgent'] }).notNull().default('none'),
  dueAt: ts('due_at'),
  scheduledFor: ts('scheduled_for'),
  completedAt: ts('completed_at'),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  parentTodoId: text('parent_todo_id'),
  createdBy: text('created_by').notNull().references(() => users.id),
  assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  source: text('source', { enum: ['manual','inbox','email','import'] }).notNull().default('manual'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
}, (t) => ({
  byStatus: index('idx_todos_status').on(t.status),
  byAssignee: index('idx_todos_assignee_status').on(t.assigneeId, t.status),
  byProject: index('idx_todos_project').on(t.projectId),
  byWorkspace: index('idx_todos_workspace').on(t.workspaceId),
  byDue: index('idx_todos_due').on(t.dueAt),
  byScheduled: index('idx_todos_scheduled').on(t.scheduledFor),
  byParent: index('idx_todos_parent').on(t.parentTodoId),
}));

// ... workspaces done; users, projects, projectMembers, events, eventAttendees,
//     references, tags, taggings, incomingItems, notifications,
//     integrationAccounts, syncLog, activityLog,
//     todoCollaborators, eventCollaborators, referenceCollaborators
```

`type Todo = typeof todos.$inferSelect;` → mirrored to Zod DTOs in `packages/shared` (or `drizzle-zod`).

---

## 7. Reserved but not built in v1

| Item | Trigger to build |
|---|---|
| `users.password_hash` / `auth_provider*` | Phase 3 (auth) |
| `workspaces` / `workspace_members` UI + active-workspace switcher | Phase 2 (sharing). Tables + `workspace_id` columns exist from Phase 0; values are `NULL` until then. |
| `notifications` producers/UI | Phase 2+ |
| `events.rrule` expansion | Recurring-events backlog. **Not painted into a corner:** if a full recurrence model is needed, add `recurrence_rules` (rule + exceptions/overrides) and `event_instances`; `events.rrule` stays as the simple case. Decision deferred, migration is additive. |
| `events.external_*`, `integration_accounts`, `sync_log` | Phase 4/5 |
| `references` rating / revisit_at / topic_id | Learn-library enhancements backlog |
| item-level collaborator tables UI | Phase 2; tables created in the Phase 0 migration |

---

## 8. Resolved decisions (was: open modeling questions)

| # | Decision |
|---|---|
| A1 | Per-type collaborator tables (`todo_/event_/reference_collaborators`). Polymorphism only in `taggings` + `activity_log`. |
| A2 | `workspaces` is its own entity with `workspace_members`; `workspace_id` **nullable** on all scoped tables; personal = `NULL`. |
| A3 | `scheduled_for` (plan-to-do day) and `due_at` (deadline) are separate nullable fields. |
| A4 | Recurrence backlogged; `rrule` column reserved; additive path documented (§7). |
| A5 | Hard delete + `activity_log`. No `deleted_at`. |
| A6 | Shared item → recipient gets an `incoming_item` (`kind = 'shared_task'/'shared_event'`) to accept; on accept it becomes a normal shared item. `notifications` table reserved for the eventual notifications surface. |
| A7 | Seed: 2 users, 1 shared workspace + 1 shared project + demo items, so sharing is demoable. |
| A8 | Home page includes a "create account" entry point; real signup/auth flow is Phase 3. |
| A9 | STOMP = **Short Term Outside Memory Planner** (working title). |

Still open → see [open-questions.md](../../06-gaps-and-questions/output/open-questions.md): tag scope edge cases, notifications scope for Phase 2, B/C sets (auth, integrations).
