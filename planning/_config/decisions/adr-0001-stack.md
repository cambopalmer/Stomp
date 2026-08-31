# ADR-0001: Application stack

**Status:** Accepted (2026-08-31)
**Context:** Owner comes from .NET / C# MVC / SQL Server. Wants something easy to read, open-source, light, containerizable, deployable cheaply later. React was requested.

## Decision

| Concern | Choice | Rationale / .NET analogue |
|---|---|---|
| Language | **TypeScript** (Node 20 LTS) | Static types ≈ C#. One language front-to-back. |
| API framework | **Fastify** | Typed, plugin-based, JSON-schema request/response validation ≈ model binding + data annotations. Lighter and faster than Express, still mainstream. |
| API structure | `routes/` → `services/` → `repositories/` | Controller → Service → Repository/DbContext. |
| ORM | **Drizzle ORM** + `drizzle-kit` | Schema-as-code in TS; generates plain SQL migrations; queries read like SQL. Closest feel to EF Core Code-First for someone who likes SQL. |
| Database | **SQLite** via `better-sqlite3`; libSQL-compatible | File-based, zero-ops locally. Swap to Turso (hosted libSQL) later with a connection-string change. |
| Validation / DTOs | **Zod** schemas in `packages/shared` | Shared request/response contracts imported by both API and web. ≈ shared ViewModel/DTO project. |
| Front end | **Vite + React + React Router** | SPA, fast dev server. |
| Server state | **TanStack Query** | Caching, mutations, invalidation. Avoids hand-rolled fetch state. |
| Forms | **React Hook Form + Zod resolver** | Same schema as the API. |
| UI | **Tailwind CSS + shadcn/ui** | Utility CSS + accessible Radix components copied into the repo (owned, not a dependency lock-in). Owner is new to both — expect a polish pass together. |
| Repo layout | **pnpm workspaces** monorepo: `apps/api`, `apps/web`, `packages/shared` | One install, shared types. |
| Container | Multi-stage **Dockerfile** + **docker-compose.yml** | `docker compose up` → api + web + SQLite volume. |
| Tests | **Vitest**; Fastify `.inject()` for API | ≈ xUnit + WebApplicationFactory. |

## Alternatives considered

- **Next.js full-stack** — fewer deploy artifacts, but couples front/back, heavier, and worse fit for a possible static-frontend + cheap-API future. Rejected for now.
- **Prisma** instead of Drizzle — great DX, but hides SQL and has a heavier engine/binary. Drizzle keeps SQL visible, which suits the owner.
- **Express** instead of Fastify — more ubiquitous, but no built-in validation and weaker typing. Minor call; Fastify wins on validation.

## Consequences

- Owner ramps on TS/React/Tailwind — accepted, with pairing on polish.
- Everything runs from one `docker compose up`.
- Hosting later: any container host (Fly.io, Render, Railway) or a small VPS. DB migrates to Turso or a mounted volume.
