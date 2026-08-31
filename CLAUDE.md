# STOMP — routing map for Claude

STOMP is a personal/shared hub: **calendar, todos, incoming (triage inbox), and a learn library**, grouped by **projects**, with a home screen of tiles and a "hot & relevant" sidebar.

**Current phase:** Phase 0 merged to `main`. Phase 1 (Fill the UI) nearly complete on branch `phase-1-ui` — detail/edit screens for todos (+subtasks, tags, activity log), events, references; project detail with tabs; tag pages; landing-page filters; dark-mode toggle; error/loading states. Only "day-grid calendar view" and "project members list" deferred to later. Open, non-blocking: D5 (brand color — using generated teal), B/C question sets.

## Where things are

| Path | What it is |
|---|---|
| `planning/PLAN.md` | The master plan. Start here. Links to every stage output. |
| `planning/IDENTITY.md` | ICM Layer 0 — what STOMP is and is not. |
| `planning/CONTEXT.md` | ICM Layer 1 — stage index + routing. |
| `planning/00-prd/` | **PRD** — goals/non-goals, personas, user stories, functional + non-functional requirements. |
| `planning/01-architecture/` | Stack decision, deployment model, ADRs. |
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

## Conventions

- TypeScript everywhere. API layering: `routes/` → `services/` (logic + authz) → Drizzle.
- SQLite: text uuid PKs, booleans as 0/1, timestamps as epoch-ms UTC. Edit `schema.ts` then `pnpm --filter @stomp/api db:generate`.
- Each folder that needs explanation gets a short `README.md` or `_index.md`.
- Update this file whenever a top-level folder is added or its purpose changes.
