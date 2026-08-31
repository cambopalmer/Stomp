# STOMP — routing map for Claude

STOMP is a personal/shared hub: **calendar, todos, incoming (triage inbox), and a learn library**, grouped by **projects**, with a home screen of tiles and a "hot & relevant" sidebar.

**Current phase:** Planning. No application code exists yet. PRD + schema + roadmap + design system written; open questions A (schema) and D (logistics) resolved (2026-08-31). `ui-ux-pro-max` + `ui-styling` skills installed (`.claude/skills/`; ADR-0004); design system generated at `design-system/stomp/MASTER.md`. Open, non-blocking: D5 (final brand color — Phase 0 uses generated teal), and the B/C question sets (auth, integrations) for their phases. `StompList/` deleted — this repo replaces it. Phase 0 build starts on the owner's go.

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

## Folders that will appear at build time (not yet created)

| Path | What it will be |
|---|---|
| `apps/api/` | Fastify + Drizzle REST API over SQLite. |
| `apps/web/` | Vite + React + Tailwind + shadcn/ui front end. |
| `packages/shared/` | Zod schemas / shared types (DTOs) used by both. |
| `infra/` | Dockerfile(s), `docker-compose.yml`, `nginx.conf`. |

## Conventions

- TypeScript everywhere. Layered API: `routes/` → `services/` → `repositories/`.
- Each folder that needs explanation gets a short `README.md` or `_index.md`.
- Update this file whenever a top-level folder is added or its purpose changes.
