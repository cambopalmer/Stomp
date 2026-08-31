# ADR-0003: Workspaces and the sharing model

**Status:** Accepted (2026-08-31)
**Context:** STOMP needs multiple users who share tasks/events/projects, but also a private "outside memory" for each individual. The owner chose a *nullable workspace* model with *workspace visibility plus per-item grants*.

## Decision

### Workspace
- New entity `workspaces` with `workspace_members` (roles: `owner`, `admin`, `editor`, `viewer`).
- **Workspace is nullable everywhere.** `projects`, `todos`, `events`, `references`, `tags`, `incoming_items` all carry a nullable `workspace_id`.
  - `workspace_id IS NULL` → a **personal** item, private to its creator (+ explicit grants).
  - `workspace_id` set → the item is *associated with* that workspace.
- A user may belong to many workspaces. The client has an "active workspace" selector; "Personal" is a valid selection (= `NULL`).
- No auto-created personal workspace — personal = `NULL`, so there's no empty-workspace bookkeeping.

### Visibility rule (per item, for user U)

Visible if **any**:
1. `item.created_by = U`
2. `item.assignee_id = U` (todos only)
3. item is in a **project U can access** (see below)
4. U has a row in the item's per-type collaborator table (`todo_collaborators` / `event_collaborators` / `reference_collaborators`)

> A loose item (`project_id IS NULL`) is **not** made visible by `workspace_id` alone — it stays private unless shared via rule 4. Workspace membership grants visibility only through projects (rule 3).

**Project U can access:**
- `project.workspace_id IS NULL` → U is `owner_id` **or** has a `project_members` row.
- `project.workspace_id` set → U is a member of that workspace (`workspace_members`) **or** has a `project_members` row (covers guests from outside the workspace).

### Edit vs view
- **Creator / owner:** full.
- **Assignee:** may change the todo's `status`, `completed_at`, `scheduled_for`; not delete or re-scope.
- **Workspace project:** effective role = the stronger of the user's `workspace_members.role` and any `project_members.role`. `editor`+ → edit; `viewer` → read.
- **Collaborator:** `editor` → edit; `viewer` → read.

### Per-item sharing kept (ADR revises ADR-0002 note)
Three per-type collaborator tables, identical shape. Chosen over a polymorphic `shares` table for FK integrity and readable SQL. Polymorphism is used only where integrity risk is low: `taggings` and `activity_log`.

### Subtasks
`todos.parent_todo_id` (self-ref, `ON DELETE CASCADE`). A subtask **always inherits the parent's `workspace_id` and `project_id`** (enforced in the service layer on create and on parent re-scope). It keeps its **own** `status`, `priority`, `due_at`, `scheduled_for`, `assignee_id`. It **cannot be shared independently** — collaborator rows are only honored on top-level todos; a subtask's visibility follows its parent.

## Consequences

- Every list/read query goes through `repositories/visibility.ts`. One place to change when auth lands.
- Phase 0 can ship with `workspace_id` always `NULL` (pure personal) and no workspace UI; the tables exist so Phase 2 adds sharing without migration.
- `tags` are personal (`workspace_id NULL`, `owner_id` set) or workspace (`workspace_id` set). Uniqueness via two partial indexes.
- Cross-workspace guest access is possible (`project_members` on a workspace project) — intentional, supports "share one project with an outsider".
- "Effective role = stronger of two roles" needs a small helper + tests.
