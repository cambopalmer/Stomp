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

Prereqs: Node 22.12+ (24 recommended — CI & Docker use 24), pnpm 9 (`npm i -g pnpm`).

```bash
pnpm install
cp .env.example .env
pnpm --filter @stomp/api db:seed     # migrate + seed users, a shared workspace, demo data
pnpm dev                             # api on :3000, web on :5173 (proxies /api)
```

> Windows: the combined `pnpm dev` can hang the API under `tsx watch`. Run the two
> servers in separate terminals instead: `pnpm --filter @stomp/api dev` and
> `pnpm --filter @stomp/web dev`.

Open http://localhost:5173 and sign in. Seeded accounts (all created by `db:seed`):

| Account | Password | Notes |
|---|---|---|
| `owner@stomp.local` | `stomp-dev-password` (`SEED_USER_PASSWORD`) | **admin** · owner of the shared workspace + demo data |
| `sam@stomp.local` | same as owner | second member of the shared workspace |
| `pamcalmer@stomp.local` | `pamcalmer` | **dev/test only** — skipped when `NODE_ENV=production`. A clean account for testing the new-user experience and cross-account sharing. |

### Authentication

Email/password is always on. Google OAuth is optional — see [`docs/GOOGLE-OAUTH.md`](docs/GOOGLE-OAUTH.md) for the full Cloud Console walkthrough; in short, set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env` and a "Continue with Google" button appears. `ALLOW_SIGNUP=false` closes open signup (the first-ever user is always allowed, and becomes the **admin**). Admins get **Manage users** in the account menu (`/admin`): change roles, disable sign-in, set a new password, delete (anonymize) an account — admins never see other people's items. Sessions are a signed httpOnly cookie (`stomp_session`, 30-day TTL); set a strong `SESSION_SECRET` in production. Tests run with `AUTH_TEST_BYPASS=true`.

### Google integrations (Phase 4)

In **Settings → Connected accounts**, each user can connect **Gmail** (messages they label `STOMP` arrive in Incoming) and **Google Calendar** (events from the calendars they pick show up read-only in the calendar). Needs the Google OAuth app from [`docs/GOOGLE-OAUTH.md`](docs/GOOGLE-OAUTH.md) — including the second redirect URI and §7 — plus `INTEGRATION_ENC_KEY` (encrypts stored tokens). The API syncs every `SYNC_INTERVAL_MINUTES` (default 10); decisions in [ADR-0005](planning/_config/decisions/adr-0005-google-integrations.md).

Useful:

```bash
pnpm typecheck                          # all packages
pnpm test                               # unit tests: shared + api + web (vitest)
pnpm --filter @stomp/web e2e            # Playwright, against a throwaway seeded API
pnpm build                              # api bundle + web static build
pnpm --filter @stomp/api db:generate    # regenerate migration after editing src/db/schema.ts
pnpm --filter @stomp/api db:studio      # Drizzle Studio — browse/edit every table in a GUI
```

## Containers

```bash
docker compose -f infra/docker-compose.yml up --build
docker compose -f infra/docker-compose.yml run --rm api node dist/db/seed.js   # once
```

Hub on http://localhost:8080. SQLite persists in the `stomp-data` volume.

## Status

Phases 0–3 are done: the full schema + visibility/sharing model; CRUD and detail screens for todos (with subtasks), events, references, projects, incoming triage and tags; workspaces, sharing and notifications; auth (email/password + optional Google) with an admin role for user management; a calendar with month / week / list views that also shows todo deadlines; structured logging + OpenTelemetry; Docker + CI.

Next (see [`planning/05-delivery/output/roadmap.md`](planning/05-delivery/output/roadmap.md)): Phase 4 — Gmail pull into Incoming and Google Calendar import (needs Google OAuth credentials).
