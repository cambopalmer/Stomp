# STOMP — routing map for Claude

STOMP is a personal/shared hub: **calendar, todos, incoming (triage inbox), and a learn library**, grouped by **projects**, with a home screen of tiles and a "hot & relevant" sidebar.

**Current phase:** Phases 0–3 + QA + observability on `main` (pushed to github.com/cambopalmer/Stomp); release-please PR bumps `0.3.0` → `0.4.0`. **Phase 3 (auth) merged 2026-09-08:** Google OAuth (optional) + email/password (argon2id), `sessions` table + signed httpOnly cookie, `authContext` 401s non-public routes (`AUTH_TEST_BYPASS` for tests), `/login` `/signup` + `UserMenu`, `ALLOW_SIGNUP` env. Public sitemap de-scoped; authed `/api/sitemap-me.xml`. Dev-only `pamcalmer@stomp.local` seed account; `pnpm --filter @stomp/api db:studio` for DB browsing. Since then: the 2 MEDIUM security findings closed, C4 map at `/architecture.html`, calendar month / week / list views with todo deadlines + a Show (all / events / todos) filter; dependency security sweep (Node 24, vitest 4, vite 7, react-router 7, OTel 0.222) and CI fixed; Phase 3 leftovers closed — hub **admin role** = user management only at `/admin` (`services/users.ts`, `routes/admin.ts`; no visibility bypass), **delete = anonymize** (schema §3a), legacy auth columns dropped, SQLite WAL + busy_timeout via `applyPragmas()` in `buildApp()`. **Phase 4 (Google integrations, ADR-0005)** merged: `/settings` connect Gmail + Calendar (`routes/integrations.ts`, `services/integrations.ts` + `sync.ts`, adapters in `src/integrations/`, `jobs/syncScheduler.ts`), tokens sealed with `INTEGRATION_ENC_KEY`. 128 API tests, 23 web unit tests (vitest, `apps/web/src/**/*.test.ts`), 49 e2e. **Phase 4.5 day planner (ADR-0006)** merged (all 6 slices): `/plan/:date` (`routes/Plan.tsx`, `components/planner/*`, `lib/planner.ts`; API `routes/planner.ts`, `services/planner.ts`, `services/anchors.ts`; wall-clock blocks, categories + admin defaults, tray, review, anchored prep blocks, copy-a-day, Home tile, installable web app). Phones get a ☰ drawer (`components/MobileNav.tsx`). Styling is **Tailwind 4** (CSS-first: `@theme inline` in `apps/web/src/index.css`, no tailwind.config.js). Trunk-only — merged branches are pruned. Open (see `planning/05-delivery/output/backlog.md`): Google app still in Testing mode (7-day token expiry — publish before relying on sync); self-service account deletion; non-security major upgrades (React 19, zod 4, TS 7, …); Tailscale (HTTPS dev access so Google sign-in works from a phone); "Plan for" dates on the calendar (on hold).

## Where things are

| Path | What it is |
|---|---|
| `planning/PLAN.md` | The master plan. Start here. Links to every stage output. |
| `planning/IDENTITY.md` | ICM Layer 0 — what STOMP is and is not. |
| `planning/CONTEXT.md` | ICM Layer 1 — stage index + routing. |
| `planning/00-prd/` | **PRD** — goals/non-goals, personas, user stories, functional + non-functional requirements. |
| `planning/01-architecture/` | `architecture.md` (topology, layering, conventions) + `c4-model.md` / `c4-model.html` (C4 model, interactive — the app serves a generated copy at `/architecture.html`, linked from its footer). Stack decision + deployment model. |
| `planning/02-data-model/` | **The schema.** 19 tables, workspace + sharing/visibility model, SQLite/Drizzle DDL, "today" query. |
| `planning/03-ui-ux/` | Information architecture, screen inventory, wireframe notes, sitemap strategy. |
| `design-system/stomp/MASTER.md` | The design system — tokens, type, spacing, motion, a11y floor. Derived from the `ui-ux-pro-max` skill. |
| `.claude/skills/` | Installed skills (`ui-ux-pro-max` + bundle). See ADR-0004. Activate on Claude Code restart. |
| `planning/04-integrations/` | Email/calendar adapter design (built later, designed now). |
| `planning/05-delivery/` | `roadmap.md` (phases) + `backlog.md` (the dogfood project's tracked items). |
| `planning/06-gaps-and-questions/` | Open questions. Section A resolved; B/C/D remain. **Read before executing anything.** |
| `planning/_config/` | ICM conventions, glossary, ADR log (ADR-0001 stack, 0002 datastore, 0003 workspaces/sharing). |

## How this repo tracks changes

- Git tracks file history.
- The planning workspace follows the **ICM pattern** (Jake Van Clief's Interpretable Context Methodology): numbered stage folders, each with a `CONTEXT.md` contract (inputs / process / outputs) and an `output/` folder. See `planning/_config/icm-conventions.md`.
- Once the app is built, runtime change-tracking lives in the `activity_log` table (see schema).

## Application code

| Path | What it is |
|---|---|
| `apps/api/` | Fastify + Drizzle REST API over libSQL/SQLite. `src/db/schema.ts` is the schema source of truth; `src/services/*` hold logic + authz (`access.ts` = visibility model); `src/routes/index.ts` = HTTP layer; `drizzle/` = generated migrations. |
| `apps/web/` | Vite + React SPA. `src/components/AppShell.tsx` (banner+nav+sidebar), `src/routes/*` (pages), `src/lib/queries.ts` (TanStack Query hooks), `src/index.css` (design tokens). |
| `packages/shared/` | Zod schemas / DTOs used by both (consumed as source). |
| `infra/` | `Dockerfile.api`, `Dockerfile.web`, `docker-compose.yml`, `nginx.conf`. |
| `.github/workflows/ci.yml` | typecheck + test + build + docker image build. |

Run: `pnpm install && pnpm --filter @stomp/api db:seed && pnpm dev`. See `README.md`.

## Versioning & commits

- **Conventional Commits** on the subject line: `feat:`, `fix:`, `perf:`, `refactor:`, `test:`, `docs:`, `build:`, `chore:` (+ optional scope, e.g. `feat(api):`). Breaking: `feat!:` or a `BREAKING CHANGE:` footer. Keep the `Co-Authored-By` / `Claude-Session` trailers.
- **release-please** watches `main` and opens a "release PR" that bumps the version + `CHANGELOG.md` from those commits. Merging that PR tags `vX.Y.Z`. Config: `release-please-config.json`, `.release-please-manifest.json`.
- Pre-1.0: `feat:` → minor bump (`0.3.0` → `0.4.0`), `fix:`/`perf:` → patch. Current: **0.3.0** (Phase 2).

## Conventions

- TypeScript everywhere. API layering: `routes/` → `services/` (logic + authz) → Drizzle.
- SQLite: text uuid PKs, booleans as 0/1, timestamps as epoch-ms UTC. Edit `schema.ts` then `pnpm --filter @stomp/api db:generate`.
- Each folder that needs explanation gets a short `README.md` or `_index.md`.
- Update this file whenever a top-level folder is added or its purpose changes.
