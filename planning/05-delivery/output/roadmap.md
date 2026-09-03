# STOMP — Roadmap

Phases are sequential but each ends at a usable state. Schema is designed complete in Phase 0 so later phases add columns/tables, never destructive migrations.

## Phase 0 — Foundation (Section A resolved; ready on the owner's go)

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

**Tranche B — done (2026-09-02, branch `phase-3-auth`):** Google OAuth (`@fastify/oauth2`, optional — no-op until `GOOGLE_CLIENT_ID`/`SECRET` set) + email/password fallback (argon2id via `@node-rs/argon2`). `sessions` table, signed httpOnly cookie `stomp_session` (30-day TTL). `authContext` plugin resolves the session and 401s non-public routes; `AUTH_TEST_BYPASS` env keeps API/e2e tests running as the seeded user. Web: `AuthProvider` + `/login` `/signup` screens, `UserMenu` (avatar + sign out), 401→login redirect. `ALLOW_SIGNUP` env gates open signup (first user always allowed). 45 API tests, 16 e2e (incl. an unauthenticated `auth` project).

Still open: migrate/prune the legacy `auth_provider`/`auth_provider_id` columns; user-deletion FK-policy consistency pass; the owner must create Google Cloud OAuth credentials (redirect URI `{PUBLIC_BASE_URL}/api/auth/google/callback`).

**Security follow-ups (from the QA pass, 2026-09-01):**
- ~~Scope `GET /sitemap.xml` to the requesting user~~ — **done (2026-09-02):** public `/api/sitemap.xml` now lists static routes only; authenticated `/api/sitemap-me.xml` returns the caller's own items. `Disallow: /` in `robots.txt` stays.
- Re-run `/security-review` against the full app (not just a branch diff) now that `authContext` is real, focusing on the visibility helpers and session handling.

## Phase 4 — Inbound integrations

Google OAuth connect in Settings. `GmailAdapter` (read-only pull → incoming). `GoogleCalendarAdapter` (one-way import → read-only events). Scheduled sync job + `sync_log` UI. Token encryption.

## Phase 5 — Outbound + two-way

Two-way calendar sync with conflict handling. Send email from Gmail. Send calendar invites. Outlook/IMAP adapters if wanted.

## Backlog (unscheduled) — see `backlog.md`

Recurring todos/events (`rrule`), reference progress tracking + topics/groups + spaced-repetition, notifications/digests, PWA/offline, attachments, search, calendar week/month grid polish, bulk actions, keyboard-first navigation, import from other tools.
