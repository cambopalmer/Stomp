# STOMP — Roadmap

Phases are sequential but each ends at a usable state. Schema is designed complete in Phase 0 so later phases add columns/tables, never destructive migrations.

## Phase 0 — Foundation ✅ shipped

**Goal:** `docker compose up` → a working hub with real persistence and CRUD.

**Deliverables**
- pnpm monorepo: `apps/api`, `apps/web`, `packages/shared`.
- Drizzle schema — **all 19 tables** from `schema.md` incl. `workspaces`, `workspace_members`, per-type collaborator tables, `notifications` (reserved) — + first generated migration + `migrate()` on boot.
- SQLite client with WAL + `busy_timeout` + `foreign_keys=ON`; `.data/` gitignored.
- Seed script: **2 users**, 1 shared workspace + 1 shared project + ~3 tags, the "STOMP Buildout" project (personal), and demo items in every section (some workspace-scoped so sharing is demoable).
- `workspace_id` is populated in seed data but there is **no workspace UI** in Phase 0 — the active workspace is fixed to "Personal" client-side.
- Fastify API:
  - `authContext` plugin injecting the seeded user.
  - CRUD routes: `todos`, `events`, `references`, `projects`, `project-members`, `incoming-items`, `tags`, `taggings`.
  - Triage endpoint: `POST /api/incoming-items/:id/triage` → creates todo/event, links, marks triaged.
  - `GET /api/home/summary` (tile counts) and `GET /api/home/hot` (sidebar payload).
  - `GET /api/sitemap.xml` dynamic.
  - Zod validation on every route via `packages/shared` schemas.
  - Visibility helper enforced on all list/read.
- React app:
  - `AppShell` (banner + tiles + hot sidebar), Home wired to `/api/home/*`.
  - Banner includes a placeholder **"Create account"** link (routes to a stub page; real signup = Phase 3).
  - Landing page per section rendering real data.
  - Create/edit/delete for **todos** (incl. subtasks) and **projects** (full RHF+Zod forms).
  - Read + basic create for events, references, incoming (full edit can slip to Phase 1).
  - Tailwind + shadcn/ui installed; ~8 primitives in.
  - `design-system/stomp/MASTER.md` tokens → `apps/web/src/index.css` CSS variables (light + dark); Plus Jakarta Sans loaded; Tailwind theme + shadcn vars point at the tokens (MASTER O8).
- Docker: `Dockerfile.api`, `Dockerfile.web`, `docker-compose.yml`, `nginx.conf`.
- CI: GitHub Actions — install, typecheck, test, build both images.
- Root `README.md` with run instructions; `.env.example`.

**Exit criteria**
- Fresh clone → `docker compose up` → hub at `localhost:8080`, data persists across restarts.
- Home counts + hot sidebar correct against seed data.
- `sitemap.xml` lists every seeded project and item.
- `pnpm test` green in CI.

## Phase 1 — Fill the UI

Full edit/detail screens for events, references, incoming. Todo subtasks UI. Filters on every landing page. Tag pages. Project detail with all four item tabs + progress. Activity-log view on detail screens. Empty/loading/error states everywhere. Dark mode pass.

## Phase 2 — Workspaces, sharing & notifications

Active-workspace switcher (incl. "Personal"). Create/manage workspaces + members. "Share" action on projects/todos/events/references (per-type collaborator tables → UI). Assignee picker. "Shared with me" views. `incoming_items` of `kind='shared_task'/'shared_event'` generated when someone shares to you; accept → becomes a normal shared item, decline → dismissed. First `notifications` producers (share invites, assignments, past-due) + a notifications panel/section.

## Phase 3 — Authentication

**Done (merged to `main` 2026-09-08):** Google OAuth (`@fastify/oauth2`, optional — no-op until `GOOGLE_CLIENT_ID`/`SECRET` set) + email/password fallback (argon2id via `@node-rs/argon2`). `sessions` table, signed httpOnly cookie `stomp_session` (30-day TTL). `authContext` plugin resolves the session and 401s non-public routes; `AUTH_TEST_BYPASS` env keeps API/e2e tests running as the seeded user. Web: `AuthProvider` + `/login` `/signup` screens, `UserMenu` (avatar + sign out), 401→login redirect. `ALLOW_SIGNUP` env gates open signup (first user always allowed). Dev-only `pamcalmer@stomp.local` seed account; `db:studio` for DB browsing. 49 API tests, 16 e2e.

**Leftovers closed 2026-10-05:** legacy `auth_provider*` columns dropped; hub admin role (user management only, no visibility bypass) + `/admin`; user deletion = anonymize, FK policy documented (schema §3a); SQLite WAL + `busy_timeout`.

Google Cloud OAuth client created by the owner 2026-10-06 (dev redirect URI `http://localhost:5173/api/auth/google/callback`); Google sign-in verified end-to-end. Phase 3 is fully closed.

**Security follow-ups — all resolved:**
- ~~Scope `GET /sitemap.xml` to the requesting user~~ — **done (2026-09-02):** public `/api/sitemap.xml` lists static routes only; authenticated `/api/sitemap-me.xml` returns the caller's own items. `Disallow: /` in `robots.txt` stays.
- ~~Re-run `/security-review` over the full app~~ — **done (2026-09-03):** 2 MEDIUM findings, both fixed 2026-09-09 — (1) `ALLOW_SIGNUP` now enforced on the Google OAuth path via `assertSignupAllowed()`; (2) `seed()` refuses to run in production while `SEED_USER_PASSWORD` is the public dev default.

## Phase 4 — Inbound integrations

**Built 2026-10-06/07 (ADR-0005)**, on branch `phase-4-integrations`: Google connect in Settings (per-product grants, AES-256-GCM tokens), Google Calendar import (picked calendars, read-only mirrors, all-day as floating dates), Gmail → Incoming (`STOMP` label), background sync every 10 min + Sync now + history. Before relying on background sync, the Google app must leave *Testing* (7-day token expiry) — `docs/GOOGLE-OAUTH.md` §7.

## Phase 4.5 — Day planner (next after Phase 4; owner request 2026-10-07)

**Problem it solves:** todos and events don't give you a *flexible schedule for the day*. The planner is a scannable, colour-coded day on a 15-minute grid where loose time blocks sit around the concrete events (own + imported Google), and the plan for each day is kept so past days can be reviewed.

**Owner direction so far:**
- Time blocks are **less rigid than todos**. Explore an underlying shared type ("time block" / "task") rather than forcing every block to be a todo.
- **Categories:** ship an intuitive default set, and let users create their own with colours. Goal: help people stay organised and steer them toward a scannable day (never colour-only meaning).
- Liked all of: morning plan + end-of-day shutdown (Sunsama), planned vs actual (Newport), drag todos onto the timeline, category colours, drag-to-resize on 15-min grid, day/week time totals, buffers, daily notes, templates, roll-over of unfinished items.
- **Smart planning, later but design for it now:** prerequisites around concrete events, e.g. *gymnastics at 6pm, 30-min drive, she needs dinner first* → the planner asks "how long is the drive?" / "what needs doing before you leave?" and suggests the travel block and the dinner block before it. Implies blocks can depend on / anchor to an event (offset + duration), and events can carry location + travel time.
- `scheduled_for` ("Plan for", on hold for the calendar) gets its home here.

**Design settled 2026-10-07 → [ADR-0006](../../_config/decisions/adr-0006-day-planner.md)** (time blocks as their own entity with optional todo link; wall-clock 15-min time; events as fixed blocks; per-user categories with admin-editable defaults; automatic planned-vs-actual; anchored "Add before…" blocks; mobile-first installable web app). Build plan: 6 slices in the backlog — **slices 1–3 built 2026-10-07** (data + API, mobile-first day view, todos tray + linked blocks) on branch `phase-4.5-planner`.

## Phase 5 — Outbound + two-way

Two-way calendar sync with conflict handling. Send email from Gmail. Send calendar invites. Outlook/IMAP adapters if wanted.

## Backlog (unscheduled) — see `backlog.md`

Recurring todos/events (`rrule`), reference progress tracking + topics/groups + spaced-repetition, notifications/digests, PWA/offline, attachments, search, calendar week/month grid polish, bulk actions, keyboard-first navigation, import from other tools.
