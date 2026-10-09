# STOMP Buildout — Backlog

This is the seed content for the **"STOMP Buildout"** project (`projects` row) and its todos. Once Phase 0 runs, this file's items are inserted as real todos so the project dogfoods itself. Keep this file and the DB in rough sync until the app is the source of truth, then this file becomes historical.

Legend: `[phase]` target phase · `⏳` deferred/uncertain pending an open question.

## Phase 0 — Foundation (shipped; ticked 2026-10-05)

- [x] `[0]` Scaffold pnpm monorepo (`apps/api`, `apps/web`, `packages/shared`)
- [x] `[0]` Drizzle schema for all 19 tables in `schema.md` (incl. workspaces, workspace_members, collaborator tables, notifications)
- [x] `[0]` Generate + wire first migration; run on API boot
- [x] `[0]` SQLite client: WAL, `busy_timeout`, `foreign_keys=ON` — `applyPragmas()` in `buildApp()` (2026-10-05; tests previously ran with FKs off)
- [x] `[0]` Zod DTO schemas in `packages/shared` (create/update/read per entity)
- [x] `[0]` `authContext` plugin (seeded user; `ctx.userId` only)
- [x] `[0]` Visibility helper (landed as `services/access.ts`) — `accessibleProjectIds` + per-entity rules + effective-role helper + tests
- [x] `[0]` Subtask service rules: inherit workspace+project, reject overrides, cascade on re-scope
- [x] `[0]` CRUD: todos (incl. subtasks)
- [x] `[0]` CRUD: projects + project_members
- [x] `[0]` CRUD: workspaces + workspace_members (API only; no UI)
- [x] `[0]` CRUD: events + attendees
- [x] `[0]` CRUD: references
- [x] `[0]` CRUD: incoming_items + `POST /:id/triage`
- [x] `[0]` CRUD: tags + taggings
- [x] `[0]` `GET /api/home/summary` + `GET /api/home/hot`
- [x] `[0]` `GET /api/sitemap.xml` dynamic + `robots.txt`
- [x] `[0]` Seed script (2 users, shared workspace + project, tags, "STOMP Buildout" project, demo items)
- [x] `[0]` Vite + React + Router + TanStack Query + Tailwind setup (no shadcn/ui — hand-rolled `components/ui.tsx`)
- [x] `[0]` MASTER.md tokens → `index.css` (light+dark CSS vars); Plus Jakarta Sans; Tailwind/shadcn wired to tokens
- [x] `[0]` `AppShell`: banner (+ "Create account" stub link) + tile grid + hot sidebar
- [x] `[0]` Home page wired to `/api/home/*`
- [x] `[0]` Landing pages: /calendar, /todos, /incoming, /learn, /projects (read real data)
- [x] `[0]` Todo create/edit/delete form (RHF + Zod)
- [x] `[0]` Project create/edit form
- [x] `[0]` QuickAdd dialog → incoming
- [x] `[0]` Dockerfiles + docker-compose + nginx.conf
- [x] `[0]` GitHub Actions: typecheck, test, build images
- [x] `[0]` Root README + `.env.example`
- [x] `[0]` Vitest setup + smoke tests for each CRUD route

## Phase 1 — Fill the UI

- [x] `[1]` Event detail/edit (`/calendar/:id` + `EventForm`)
- [x] `[1]` Calendar views — month grid, week time-grid, list-by-day; `?view=` + `?date=` in the URL, prev/today/next, click-a-day to add (2026-09-09)
- [x] `[1]` Todos on the calendar — open todos with a deadline shown as all-day items in all three views (overdue marked), **Show** filter All / Events / Todos (`?show=`); API `GET /todos?dueFrom=&dueTo=`; web unit tests (vitest) for the calendar helpers (2026-10-05)
- [ ] `[1]` Calendar: also show todos by "Plan for" (`scheduled_for`)? — decide whether it belongs on the calendar and how it differs visually from a deadline
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
- [x] `[3]` 🔒 Re-run `/security-review` over the whole app now that auth is real *(run 2026-09-03: 2 MEDIUM findings, both fixed 2026-09-09)*
- [x] `[3]` 🔒 **Enforce `ALLOW_SIGNUP` on the Google OAuth path** — `assertSignupAllowed()` helper now gates new-account creation in both `signup()` and `upsertGoogleUser()`; linking Google to an existing account stays ungated. Closed-signup Google callback redirects to `/login?error=signup_closed`. *(security-review 2026-09-03 MEDIUM → fixed 2026-09-09)*
- [x] `[3]` 🔒 **Production guard for `SEED_USER_PASSWORD`** — `seed()` throws in production while the password is the public default (`config.seedUserPasswordIsDefault`). compose + `.env.example` note the requirement. *(security-review 2026-09-03 MEDIUM → fixed 2026-09-09)*
- [x] `[3]` In-app **admin role** (2026-10-05) — `users.role` + migration `0004` (earliest account bootstrapped to admin; first signup on a fresh install becomes admin). **Scoped down from the original spec:** user management only (list, role, disable/enable, set password, delete) — *no* routes that bypass the visibility model; `db:studio` stays the operator's escape hatch. Seeded owner is admin. `/admin` page + "Manage users" menu item. API + e2e tests.
- [x] `[3]` Legacy `auth_provider` / `auth_provider_id` column cleanup — dropped in migration `0003` (2026-10-05)
- [x] `[3]` User-deletion FK-policy consistency pass (2026-10-05) — decided **delete = anonymize** (schema §3a): items others can see stay as "Deleted user", private ones removed, memberships/sessions/inbox cleared, sole workspace owner replaced. FKs left as NO ACTION (same effect as RESTRICT in SQLite; users are never hard-deleted) and the doc corrected to match, instead of a 10-table rebuild. Found + fixed on the way: deleting a todo orphaned its subtasks (`parent_todo_id` has no FK).
- [x] `[3]` **Admin panel: tools & links** on `/admin` (done 2026-10-08 — `GET /api/admin/tools`; set `GOOGLE_CLOUD_PROJECT` for the console links) (requested 2026-10-06) — one place for operator links: (1) **Data browser** — Drizzle Studio (`pnpm --filter @stomp/api db:studio`, opens https://local.drizzle.studio); dev-only: it's a local CLI, so the link only works while it runs on the operator's machine — show it with that hint, hide in production; (2) **Architecture map** — `/architecture.html`; (3) **Google Cloud console** — deep links to the OAuth app's Audience (test users / publishing status), Clients (credentials) and Data Access (scopes) pages, shown when `googleOAuthConfigured`; project id via an env var (e.g. `GOOGLE_CLOUD_PROJECT`) so links land on the right project.
- [ ] `[3]` Self-service account deletion ("Delete my account" in settings) — reuse `deleteUser`/anonymize; needs a password re-check

## Phase 4 — Inbound integrations

- [x] `[4]` Google OAuth connect in Settings + token encryption — slice 1 (2026-10-06): per-product grants, AES-256-GCM tokens, needs-reauth handling, `/settings`
- [x] `[4]` GoogleCalendarAdapter (one-way import) — slice 2 (2026-10-06): calendar picker, windowed refresh, read-only mirrors, all-day as floating dates, Sync now
- [x] `[4]` GmailAdapter (read-only pull → incoming) — slice 3 (2026-10-06): `STOMP`-labelled mail → Incoming (headers + snippet), idempotent, Open in Gmail link, triage keeps the link + `source=email`
- [x] `[4]` Scheduled sync job (every 10 min) + sync_log UI — slice 4 (2026-10-07): in-process scheduler, no-overlap, log pruning, interrupted-run cleanup, Settings history
- [x] `[4]` Provider list beyond Gmail (C1) → **Google only** for Phase 4 (ADR-0005)
- [ ] `[later]` Outlook / Microsoft 365 (Graph) — mail + calendar adapters behind the same interfaces; needs an Azure app registration. Owner wants this eventually.
- [x] `[4]` Home tiles + hot sidebar match all-day events by floating date (`dayBounds().floatingDay`) — fixed in slice 2

## Phase 4.5 — Day planner (see roadmap for the problem statement + owner direction)

- [x] `[4.5]` Design session (2026-10-07) → ADR-0006
- [x] `[4.5]` **Slice 1 — foundation:** (done 2026-10-07) `categories` + `default_categories` (seeded 8 + Uncategorized), `time_blocks`, `day_notes`; API CRUD with wall-clock validation (15-min grid, no midnight crossing); lazy planned-time snapshot; web saves browser timezone to `users.timezone`
- [x] `[4.5]` **Slice 2 — day view (mobile-first):** (done 2026-10-07; 24 px per 15 min) `/plan/:date` timeline, now-line, events as fixed blocks (all visible, ignores workspace switcher), overlap layout, tap-a-slot bottom sheet (title, category chips, duration presets, −15/+15), Plan nav item
- [x] `[4.5]` **Slice 3 — todos:** (done 2026-10-07) tray (Plan for today / due today / overdue → Schedule at…), linked blocks, "also complete the todo?" prompt, struck-through blocks for completed todos
- [x] `[4.5]` **Slice 4 — review:** (done 2026-10-08; touch resize stays in the sheet — an edge handle is too small for fingers) status (done/skipped), planned vs actual on past days, day notes, totals by category; desktop drag-create/move/resize + keyboard; long-press drag on touch
- [x] `[4.5]` **Slice 5 — anchored blocks:** (done 2026-10-08; a block that would cross midnight is pulled back to end at 24:00) "Add before…" on events (first = Travel), blocks follow event moves (incl. day changes), flagged + kept on cancel/delete/sync removal
- [x] `[4.5]` **Slice 6 — extras:** (done 2026-10-08; the installed app opens straight to /plan; icons rendered from `public/icon.svg` by `apps/web/scripts/gen-icons.mjs`) copy a previous day's plan, Home "Now / Next" tile, admin default-category editor (additions reach everyone), installable PWA (manifest + icons)
- [ ] `[4.5+]` Prep templates (suggest "before Gymnastics: Drive 30, Dinner 30"); weekly totals; named templates; reminders; sharing; travel-time lookup; offline

## Phase 5 — Outbound + two-way

- [ ] `[5]` Two-way calendar sync + conflict handling
- [ ] `[5]` Send email / send invites
- [ ] `[5]` Outlook / IMAP adapters (if wanted)

## Unscheduled backlog

- [x] 🔒 **Dependency upgrade sweep** (2026-10-05) — `pnpm audit` 35 → 1: in-range updates (fastify 5.12.5), vitest 4.1, vite 7, plugin-react 5, react-router 7, OpenTelemetry sdk 0.222 / auto-instr 0.80, esbuild 0.25 (+ pnpm override for drizzle-kit's `@esbuild-kit`). Node 20 (EOL) → 24 in CI + Docker; `engines` ≥22.12. Also fixed CI, which had never passed setup (duplicate pnpm version).
- [x] 🔒 **braces** (high) + **postcss-selector-parser** (moderate, new) advisories — both via tailwindcss 3, build-time only. **Cleared by the Tailwind 3 → 4 migration (2026-10-08)**; `pnpm audit` → no known vulnerabilities.
- [ ] **Non-security major upgrades** — deliberately left out of the sweep; each is a migration, do one at a time: ~~Tailwind 3 → 4~~ (done 2026-10-08), React 18 → 19 (+ `@types/react*`), zod 3 → 4 (+ `fastify-type-provider-zod` 7, `@hookform/resolvers` 5 — move together), TypeScript 5 → 7, Vite 7 → 8 (Rolldown) + plugin-react 6, pino 10, `@fastify/cors` 11, `fastify-plugin` 6, dotenv 18, `@libsql/client` 0.18. Consider Renovate/Dependabot version-update PRs so this doesn't pile up again.
- [ ] Recurring todos / events (`rrule` expansion)
- [ ] Reference: progress %, topics/groups, spaced-repetition review queue
- [ ] Notifications / daily digest email
- [ ] PWA / offline
- [ ] Attachments on todos & references (needs a storage decision — open question C5)
- [ ] Full-text search across sections
- [ ] Bulk actions, keyboard-first navigation
- [ ] Importers (Todoist, Google Tasks, .ics, bookmarks HTML)
