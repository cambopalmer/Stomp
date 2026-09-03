# STOMP — Short Term Outside Memory Planner

A lightweight, self-hostable hub for **calendar, todos, an incoming triage inbox, and a learn library**, grouped by **projects** inside optional **workspaces**. Home screen = banner + tiles + a "hot & relevant" sidebar.

Planning lives in [`planning/`](planning/PLAN.md) (ICM workspace). Design system: [`design-system/stomp/MASTER.md`](design-system/stomp/MASTER.md).

## Stack

TypeScript · Fastify · Drizzle ORM · libSQL/SQLite · Zod · Vite + React · Tailwind + design tokens · pnpm workspaces · Docker.

```
apps/api        Fastify REST API over SQLite (libSQL)
apps/web        Vite + React SPA
packages/shared Zod schemas / DTOs shared by both
infra           Dockerfiles, compose, nginx
```

## Local development

Prereqs: Node 20+, pnpm 9 (`npm i -g pnpm`).

```bash
pnpm install
cp .env.example .env
pnpm --filter @stomp/api db:seed     # migrate + seed 2 users, a shared workspace, demo data
pnpm dev                             # api on :3000, web on :5173 (proxies /api)
```

Open http://localhost:5173 and sign in as the seeded owner (`owner@stomp.local` / `stomp-dev-password`, override via `SEED_USER_PASSWORD`).

### Authentication

Email/password is always on. Google OAuth is optional — see [`docs/GOOGLE-OAUTH.md`](docs/GOOGLE-OAUTH.md) for the full Cloud Console walkthrough; in short, set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env` and a "Continue with Google" button appears. `ALLOW_SIGNUP=false` closes open signup (the first-ever user is always allowed). Sessions are a signed httpOnly cookie (`stomp_session`, 30-day TTL); set a strong `SESSION_SECRET` in production. Tests run with `AUTH_TEST_BYPASS=true`.

Useful:

```bash
pnpm typecheck        # all packages
pnpm test             # shared + api (21 tests)
pnpm build            # api bundle + web static build
pnpm --filter @stomp/api db:generate   # regenerate migration after editing src/db/schema.ts
```

## Containers

```bash
docker compose -f infra/docker-compose.yml up --build
docker compose -f infra/docker-compose.yml run --rm api node dist/db/seed.js   # once
```

Hub on http://localhost:8080. SQLite persists in the `stomp-data` volume.

## Phase 0 status

Working: schema (19 tables) + migrations + seed · API CRUD for todos (incl. subtasks), projects, events, references, incoming + triage, tags, workspaces · `/home/summary` + `/home/hot` · dynamic `/sitemap.xml` · visibility/sharing model enforced · React shell (banner, nav, hot sidebar) · Home, Todos (create/edit/delete), Projects (create), Calendar/Incoming/Learn (read + triage) · Docker + CI.

Not yet (see [`planning/05-delivery/output/roadmap.md`](planning/05-delivery/output/roadmap.md)): auth/login, workspace switcher & sharing UI, full event/reference edit screens, notifications, Gmail/Calendar sync. The API acts as a single seeded user until Phase 3.
