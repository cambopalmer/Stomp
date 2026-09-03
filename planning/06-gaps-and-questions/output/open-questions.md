# STOMP — Open Questions & Gaps

**Section A (Phase 0 blockers) — RESOLVED 2026-08-31.** Recorded below for traceability; live detail in [schema §8](../../02-data-model/output/schema.md) and [ADR-0003](../../_config/decisions/adr-0003-workspaces-and-sharing.md).

Sections **B** and **C** are answerable as their phase approaches. Section **D** is logistics still open.

---

## A. Phase 0 blockers — resolved

| # | Question | Resolution |
|---|---|---|
| A1 | Item-level sharing: per-type tables vs polymorphic | **Per-type** `todo_/event_/reference_collaborators`. Polymorphism only in `taggings` + `activity_log`. |
| A2 | Workspace / household above users? | **`workspaces` + `workspace_members`**; `workspace_id` **nullable** on all scoped tables; personal = `NULL`; a user can belong to many. |
| A3 | `scheduled_for` vs `due_at` | **Separate** nullable fields. `scheduled_for` = plan-to-do day (drives "Today"), `due_at` = deadline. |
| A4 | Recurrence now or backlog | **Backlog.** `events.rrule` reserved. Not cornered: additive path to `recurrence_rules` + `event_instances` documented (schema §7). |
| A5 | Hard vs soft delete | **Hard delete + `activity_log`.** No `deleted_at`. |
| A6 | Shared item → what recipient sees | **`incoming_item`** (`kind='shared_task'/'shared_event'`) to accept/decline. Accept → normal shared item. `notifications` table reserved for the eventual notifications surface (Phase 2+). |
| A7 | Seed data | **2 users**, 1 shared workspace + 1 shared project + demo items across every section; some workspace-scoped so sharing is demoable. |
| A8 | Public reachability | Private by default (`robots.txt Disallow: /`). **Home page carries a "Create account" entry point**; real signup flow = Phase 3. |
| A9 | What is "STOMP" | **Short Term Outside Memory Planner** (working title; open to workshopping later). |

### Follow-up decisions folded in (from the A-round clarifications)

- **Subtasks** (`parent_todo_id`): inherit parent's `workspace_id` + `project_id`; keep own `status`/`priority`/`due_at`/`scheduled_for`/`assignee_id`; **not** shareable independently (visibility follows the parent).
- **Notifications**: table created in the Phase 0 migration, **zero producers** until Phase 2. Eventually covers: upcoming event reminders, past-due / needs-attention, share invites, assignments, mentions.
- **"Effective role"** on workspace projects = stronger of workspace role and per-project role. Needs a helper + tests.

---

## B. Phase 3 blockers (auth) — RESOLVED (2026-09-02, branch `phase-3-auth`)

- **B1** Auth method → **Google OAuth (optional) + email/password fallback**, argon2id. No magic link.
- **B2** Session strategy → **httpOnly cookie session** (`sessions` table, signed `stomp_session` cookie, 30-day TTL, server-revocable).
- **B3** Signup model → **`ALLOW_SIGNUP` env flag** (default open for dev; set `false` for invite-only). First-ever user always allowed. Explicit invite flow deferred.
- **B4** Seeded users → **kept as real accounts**: seed sets `passwordHash` from `SEED_USER_PASSWORD`; Google links on first login by matching email. Not wiped.

---

## C. Phase 4/5 blockers (integrations) — answer later

- **C1** Providers beyond Gmail at Phase 4? (Outlook/Graph, generic IMAP?)
- **C2** Outbound email: send from your Gmail, or draft-only? Invites Google-only?
- **C3** Sync cadence, and user-configurable?
- **C4** Token encryption key on a small host: env var vs host secret store?
- **C5** Attachments on todos/references at all? If yes: local disk vs object storage (S3/R2)?
- **C6** Notifications delivery: in-app only, email digest, browser push?
- **C7** Comments / discussion threads on todos and events? (not modeled)
- **C8** PWA / offline support — needed for phone use, or is responsive web enough?

---

## D. Logistics

- **D1 — `ui-ux-pro-max` skill. DONE.** Installed via `npm i -g ui-ux-pro-max-cli` + `uipro init --ai claude`. Design system authored at `design-system/stomp/MASTER.md`; Stage 03 re-run against it. See [ADR-0004](../../_config/decisions/adr-0004-design-tooling.md).
- **D2 — `StompList/` repo. DONE.** Deleted; this repo replaces it.
- **D3 — Prune skill bundle. DONE.** Kept `ui-ux-pro-max` + `ui-styling`; removed `design` (shadowed the built-in), `banner-design`, `brand`, `design-system`, `slides`. Revisit if one becomes relevant.
- **D4 — Python 3. DONE.** Installed (3.12.10). `MASTER.md` regenerated via the skill's `--design-system --persist` generator and reconciled (generated spine + STOMP overrides section).
- **D5 — Brand color. OPEN (not blocking Phase 0).** Generator picked a teal `#0D9488` + orange `#EA580C` palette. Two sanctioned alternates in [MASTER O2](../../../design-system/stomp/MASTER.md): Micro-SaaS indigo, or sage-neutral. Phase 0 uses teal; pick a final before Phase 1 polish.

---

## E. Known gaps (flagging, not blocking Phase 0)

1. **Tag uniqueness in SQLite** — personal vs workspace tags need two partial unique indexes (`WHERE workspace_id IS NULL` / `IS NOT NULL`). Confirmed approach; noting the SQLite-specific mechanics.
2. **Tag portability** — if a personal tag is later applied to a workspace item (or vice versa), do we copy/promote the tag to the workspace? *(Default: tags stay in their scope; applying a personal tag to a shared item just means collaborators don't see the tag. Revisit in Phase 2.)*
3. **Rate limiting / abuse** on the API — skip while private; add before any public exposure.
4. **Backup automation** — ADR-0002 notes `VACUUM INTO`; not scheduled yet.
5. **Migration rollback** — Drizzle generates forward-only migrations; mitigation is a file copy before `migrate()`.
6. **Multi-timezone "today" math** — needs a tested `lib/day.ts` (DST edges).
7. **Optimistic concurrency** — two users editing one shared todo: last-write-wins in v1; `updated_at` stored; add `If-Unmodified-Since`-style check in Phase 2 if it bites.
8. **Avatar hosting** — URL field only; no upload.
9. **i18n / l10n** — English only, not designed for translation.
10. **Guest (cross-workspace) UX** — `project_members` on a workspace project is supported by the model; the invite/label UX for "someone outside this workspace" is a Phase 2 design task.

## F. From the `/code-review` passes (2026-09-02)

**Pass 1 (spec / early impl) — fixed:** hot-list priority sorted alphabetically not by urgency; Home/hot events query missed collaborator-shared events; hard delete left orphan `taggings` rows; `tags.workspace_id` was `ON DELETE CASCADE` (now `SET NULL`, migration `0001`).

**Pass 2 (implementation, `ecdf53c..HEAD`) — fixed:**
- subtask cascade used `patch.x ?? current.x`, so clearing a parent's project/workspace re-applied the old value to subtasks — now resolves the target scope explicitly and applies nulls
- `updateTodo` validated the assignee against the *old* workspace and skipped re-validation on a workspace re-scope — could leave a personal todo assigned to someone else — now validates against the resulting scope
- `listCollaborators` had no authz (any user could enumerate any item's collaborators + emails by id) — now `assertCanView` (creator / collaborator / project member)
- the share's Incoming notice used the item's `workspace_id`, so a cross-workspace recipient never saw it and couldn't decline — now goes to their personal inbox (`workspace_id = null`)
- `notifications.computeTransient` event-reminder query missed collaborators (same bug as Home) — now reuses `visibleEventsCond`
- re-sharing wasn't idempotent — dup inbox items + notifications on every click — now no-ops (optionally bumps role) if already shared
- `sharedWithMe` loaded whole `todos`/`events`/`references` tables into memory — now an indexed SQL filter
- `homeSummary` recomputed `accessibleProjectIds` ~5× (twice serially) — now computed once and threaded
- a shared **reference** produced a `system` inbox item (convert-to-todo buttons, no decline path) — added `shared_reference` kind + `linked_entity_type = 'reference'`; Accept/Decline now works

**Deferred:**
1. **No DB-level `CHECK` constraints on enums.** `text('x',{enum:[...]})` in Drizzle is compile-time only; the migration emits no `CHECK`. Zod guards the API boundary, so a bad value only lands via a service bug or raw SQL. Add hand-written `CHECK`s (or `.check()`) if we ever want the DB as the last line of defense.
2. **`references` is a SQL reserved word.** Fine through Drizzle (auto-quoted) and the generated migration. Any *hand-written* raw SQL must double-quote `"references"`.
3. **All-day events + timezone.** `events.timezone` exists but range queries compare raw UTC-ms; there's no all-day storage convention. No live bug (the UI can't create all-day events yet), but define the convention before that lands.
4. **User-deletion policy is inconsistent** — `created_by`/`owner_id` are `RESTRICT`, `tags.owner_id` is `CASCADE`, `incoming_items.created_by` is `SET NULL`. No user-delete flow exists yet; pick one policy and document the procedure in Phase 3.
5. **Visibility logic is duplicated** across `home.ts` / `todos.ts` / `events.ts` / `references.ts`. `visibleEventsCond` is now shared; the todo/reference ones could be consolidated similarly to prevent drift.
