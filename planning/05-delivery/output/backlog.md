# STOMP Buildout — Backlog

This is the seed content for the **"STOMP Buildout"** project (`projects` row) and its todos. Once Phase 0 runs, this file's items are inserted as real todos so the project dogfoods itself. Keep this file and the DB in rough sync until the app is the source of truth, then this file becomes historical.

Legend: `[phase]` target phase · `⏳` deferred/uncertain pending an open question.

## Phase 0 (today)

- [ ] `[0]` Scaffold pnpm monorepo (`apps/api`, `apps/web`, `packages/shared`)
- [ ] `[0]` Drizzle schema for all 19 tables in `schema.md` (incl. workspaces, workspace_members, collaborator tables, notifications)
- [ ] `[0]` Generate + wire first migration; run on API boot
- [ ] `[0]` SQLite client: WAL, `busy_timeout`, `foreign_keys=ON`
- [ ] `[0]` Zod DTO schemas in `packages/shared` (create/update/read per entity)
- [ ] `[0]` `authContext` plugin (seeded user; `ctx.userId` only)
- [ ] `[0]` Visibility helper (`repositories/visibility.ts`) — `accessibleProjectIds` + per-entity rules + effective-role helper + tests
- [ ] `[0]` Subtask service rules: inherit workspace+project, reject overrides, cascade on re-scope
- [ ] `[0]` CRUD: todos (incl. subtasks)
- [ ] `[0]` CRUD: projects + project_members
- [ ] `[0]` CRUD: workspaces + workspace_members (API only; no UI)
- [ ] `[0]` CRUD: events + attendees
- [ ] `[0]` CRUD: references
- [ ] `[0]` CRUD: incoming_items + `POST /:id/triage`
- [ ] `[0]` CRUD: tags + taggings
- [ ] `[0]` `GET /api/home/summary` + `GET /api/home/hot`
- [ ] `[0]` `GET /api/sitemap.xml` dynamic + `robots.txt`
- [ ] `[0]` Seed script (2 users, shared workspace + project, tags, "STOMP Buildout" project, demo items)
- [ ] `[0]` Vite + React + Router + TanStack Query + Tailwind + shadcn/ui setup
- [ ] `[0]` MASTER.md tokens → `index.css` (light+dark CSS vars); Plus Jakarta Sans; Tailwind/shadcn wired to tokens
- [ ] `[0]` `AppShell`: banner (+ "Create account" stub link) + tile grid + hot sidebar
- [ ] `[0]` Home page wired to `/api/home/*`
- [ ] `[0]` Landing pages: /calendar, /todos, /incoming, /learn, /projects (read real data)
- [ ] `[0]` Todo create/edit/delete form (RHF + Zod)
- [ ] `[0]` Project create/edit form
- [ ] `[0]` QuickAdd dialog → incoming
- [ ] `[0]` Dockerfiles + docker-compose + nginx.conf
- [ ] `[0]` GitHub Actions: typecheck, test, build images
- [ ] `[0]` Root README + `.env.example`
- [ ] `[0]` Vitest setup + smoke tests for each CRUD route

## Phase 1 — Fill the UI

- [x] `[1]` Event detail/edit (`/calendar/:id` + `EventForm`) — day grid still TODO
- [x] `[1]` Reference detail/edit (`/learn/:id` + `ReferenceForm`)
- [x] `[1]` Incoming full triage UI (inline → Todo / → Event forms + Dismiss)
- [x] `[1]` Todo detail (`/todos/:id`) + subtasks UI
- [x] `[1]` Filters on todos (priority, project) + learn (status, favorite)
- [x] `[1]` Tag pages (`/tags/:name`) + tag editor on todo detail (`GET /tags/:id/items`, `GET /taggings`)
- [x] `[1]` Project detail: 4 item tabs + progress bar (members list still TODO — Phase 2)
- [x] `[1]` Activity-log panel on todo detail (`GET /activity?entityType&entityId`)
- [x] `[1]` Empty / loading / error states (`ErrorState`, `QueryBoundary`)
- [x] `[1]` Dark mode pass (banner toggle, `lib/theme.ts`, tokens)

## Phase 2 — Workspaces, sharing & notifications

- [x] `[2]` Active-workspace switcher (incl. "Personal") — banner dropdown, `lib/workspace.tsx`
- [x] `[2]` Workspace scoping: `?workspaceId=` on todos/projects/events/references/incoming lists; new items default to the active workspace; membership enforced on create
- [x] `[2]` Create/manage workspaces + members UI (`/workspaces`, add member by email)
- [x] `[2]` Collaborator (share) UI on todo/event/reference detail (add by email, role, remove); `GET/POST/DELETE /{kind}s/:id/collaborators`
- [x] `[2]` Assignee picker on todos (workspace members; membership enforced)
- [x] `[2]` "Shared with me" view (`/shared`, `GET /shared-with-me`)
- [x] `[2]` Share → recipient gets an `incoming_item` (kind shared_task/shared_event) in their inbox
- [x] `[2]` `notifications` — producers (share_invite, assignment) + on-read computed (past_due, event_reminder) + banner bell/panel with unread count, mark read / mark all
- [x] `[2]` Accept/decline on the shared incoming item (accept = keep + clear; decline = leave the share)
- [x] `[2]` Home summary + hot list scoped to the active workspace (`?workspaceId=` on `/home/*`)

**Phase 2 complete.**

## Phase 3 — Auth

- [x] `[3]` Auth method: **Google OAuth (optional) + email/password** (argon2id) — B1 resolved
- [x] `[3]` **Session** (`sessions` table, signed httpOnly `stomp_session` cookie, 30-day TTL) + `/login` `/signup` — B2 resolved
- [x] `[3]` Wire "Create account" home entry point into the real signup flow (`UserMenu` replaces the stub link)
- [x] `[3]` Swap `authContext` plugin (resolves session, 401s non-public routes, `AUTH_TEST_BYPASS` for tests)
- [x] `[3]` Seed users kept as real accounts (`passwordHash` from `SEED_USER_PASSWORD`; Google links by email) — B4 resolved
- [x] `[3]` 🔒 Scope the public sitemap (`lib/sitemap.ts`) — `/api/sitemap.xml` static-only; authed `/api/sitemap-me.xml` per-user
- [x] `[3]` `db:studio` script — Drizzle Studio DB browser for dev inspection
- [x] `[3]` `pamcalmer@stomp.local` / `pamcalmer` dev/test account — seeded only when `NODE_ENV !== production`
- [ ] `[3]` 🔒 Re-run `/security-review` over the whole app now that auth is real *(run 2026-09-03: 2 MEDIUM findings below)*
- [ ] `[3]` 🔒 **Enforce `ALLOW_SIGNUP` on the Google OAuth path** — `upsertGoogleUser` creates new accounts unconditionally; the password `signup()` path gates on the flag but the OAuth callback does not. Add the same first-user/`ALLOW_SIGNUP` check before inserting a new user in `services/auth.ts:upsertGoogleUser` (linking to an existing account stays allowed). *(security-review 2026-09-03, MEDIUM)*
- [ ] `[3]` 🔒 **Production guard for `SEED_USER_PASSWORD`** — it defaults to the public string `stomp-dev-password` and `seed.ts` gives both demo accounts that password; unlike `SESSION_SECRET` there is no `NODE_ENV=production` check. Refuse to seed non-dev accounts in production unless `SEED_USER_PASSWORD` is explicitly set (or generate + print a random one). *(security-review 2026-09-03, MEDIUM)*
- [ ] `[3]` ⏳ In-app **admin role** — `users.role` (`member` | `admin`) + migration, `admin@stomp.local` dev account, admin-only read routes that bypass the visibility model, minimal `/admin` table browser in the SPA. Prod-gated seed. Its own authz surface — review before merge.
- [ ] `[3]` Legacy `auth_provider` / `auth_provider_id` column cleanup (kept to avoid a rename migration)
- [ ] `[3]` User-deletion FK-policy consistency pass

## Phase 4 — Inbound integrations

- [ ] `[4]` Google OAuth connect in Settings + token encryption
- [ ] `[4]` GmailAdapter (read-only pull → incoming)
- [ ] `[4]` GoogleCalendarAdapter (one-way import)
- [ ] `[4]` Scheduled sync job + sync_log UI
- [ ] `[4]` ⏳ Provider list beyond Gmail (open question C1)

## Phase 5 — Outbound + two-way

- [ ] `[5]` Two-way calendar sync + conflict handling
- [ ] `[5]` Send email / send invites
- [ ] `[5]` Outlook / IMAP adapters (if wanted)

## Unscheduled backlog

- [ ] Recurring todos / events (`rrule` expansion)
- [ ] Reference: progress %, topics/groups, spaced-repetition review queue
- [ ] Notifications / daily digest email
- [ ] PWA / offline
- [ ] Attachments on todos & references (needs a storage decision — open question C5)
- [ ] Full-text search across sections
- [ ] Calendar week/month grid
- [ ] Bulk actions, keyboard-first navigation
- [ ] Importers (Todoist, Google Tasks, .ics, bookmarks HTML)
