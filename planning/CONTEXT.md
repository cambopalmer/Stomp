# CONTEXT — stage routing (ICM Layer 1)

Execute stages in order. Each stage reads its own `CONTEXT.md`, consumes prior `output/`, and writes to its own `output/`. Human review gate between every stage.

| Stage | Job | Key output |
|---|---|---|
| `00-prd` | PRD: goals/non-goals, personas, user stories, functional + non-functional requirements | `output/prd.md` |
| `01-architecture` | Choose stack, deployment model, record ADRs | `output/architecture.md` |
| `02-data-model` | Design the schema: 4 sections + projects + workspaces + sharing + reserved integrations/notifications | `output/schema.md` |
| `03-ui-ux` | Screen inventory, information architecture, sitemap strategy, wireframe notes | `output/ui-ux.md` |
| `04-integrations` | Adapter interface for email/calendar; what's stubbed vs live in v1 | `output/integrations.md` |
| `05-delivery` | Phase plan + backlog for the dogfood project | `output/roadmap.md`, `output/backlog.md` |
| `06-gaps-and-questions` | Collect every unresolved decision blocking the build | `output/open-questions.md` |

## Confirmed decisions (from user, 2026-08-31)

- **Hosting:** local development first (Docker container is fine), cheap hosting later.
- **Datastore:** SQLite (libSQL/Turso-compatible).
- **Calendar:** own store in v1; two-way Google sync is a later phase.
- **Auth:** multi-user + sharing *in the schema now*; one seeded user, no login screen in v1; home has a "create account" entry point (real signup = Phase 3).
- **Workspaces:** own entity + members; `workspace_id` nullable everywhere (personal = NULL); visibility flows through projects; per-item grants on top. See ADR-0003.
- **Sharing:** per-type collaborator tables; polymorphism only for `taggings` + `activity_log`.
- **Subtasks:** inherit parent's workspace + project; own status/dates/assignee; not shareable alone.
- **References:** tagged link library in v1; tracking / groups / topics / spaced-repetition backlogged.
- **Incoming:** one inbox for quick-capture + items shared to you (accept/decline).
- **Notifications:** `notifications` table reserved now; producers/surface = Phase 2+.
- **Recurrence:** backlogged; `rrule` reserved; additive migration path documented.
- **Delete:** hard delete + `activity_log`.
- **Email/Gmail:** design schema + adapter interface now, build later.
- **Projects:** group *all* item types; personal or workspace-scoped; shareable.
- **Today's build scope:** PRD + SQLite schema + API CRUD for all sections + minimal UI.
- **Stack:** TypeScript, Fastify, Drizzle ORM, SQLite, Zod, Vite/React, Tailwind + shadcn/ui, pnpm monorepo, Docker Compose.
- **Sidebar rule:** high-priority open todos + due-today + overdue + un-triaged incoming.
- **Seed:** 2 users, 1 shared workspace + project, demo items across every section.
