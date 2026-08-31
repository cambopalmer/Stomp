# STOMP — Architecture

## 1. Runtime topology

```
┌─────────────────────────────────────────────┐
│ docker compose                              │
│                                             │
│  ┌───────────────┐      ┌────────────────┐   │
│  │ web (nginx)   │──────│ api (Fastify)  │   │
│  │ static React  │ /api │ Node 20        │   │
│  │ :8080         │─────▶│ :3000          │   │
│  └───────────────┘      └───────┬────────┘   │
│                                 │            │
│                          ┌──────▼───────┐    │
│                          │ SQLite file  │    │
│                          │ (named vol)  │    │
│                          └──────────────┘    │
└─────────────────────────────────────────────┘
```

- **Local dev:** run `pnpm dev` — Vite on `:5173` proxying `/api` to Fastify on `:3000`; SQLite file in `apps/api/.data/stomp.db`.
- **Container:** two images. `web` serves the built SPA via nginx and reverse-proxies `/api` to `api`. `api` runs migrations on boot, then serves. SQLite lives on a named volume so data survives `down`/`up`.
- **Later hosting:** push both images to a registry; deploy to Fly.io / Render / Railway. Or collapse to a single image where Fastify also serves the static build. DB → Turso or a host volume.

## 2. Monorepo layout

```
STOMP/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── routes/          # HTTP layer — thin, validates, calls services
│   │   │   ├── services/        # business logic, authorization checks
│   │   │   ├── repositories/    # Drizzle queries, the only DB touchpoint
│   │   │   ├── db/
│   │   │   │   ├── schema.ts     # Drizzle table definitions (source of truth)
│   │   │   │   ├── client.ts     # connection, WAL pragma, busy_timeout
│   │   │   │   └── seed.ts       # seed user + demo data
│   │   │   ├── lib/              # sitemap, ids, time, errors
│   │   │   ├── plugins/          # fastify plugins: cors, auth-context, error handler
│   │   │   └── server.ts
│   │   ├── drizzle/              # generated SQL migrations (committed)
│   │   └── drizzle.config.ts
│   └── web/
│       ├── src/
│       │   ├── routes/           # one folder per section + home
│       │   ├── components/       # shared UI (banner, tile, sidebar, item cards)
│       │   ├── components/ui/    # shadcn/ui primitives
│       │   ├── lib/              # api client, query hooks, formatting
│       │   └── main.tsx
│       └── index.html
├── packages/
│   └── shared/
│       └── src/
│           ├── schemas/          # Zod schemas per entity (create/update/DTO)
│           └── types.ts          # inferred TS types re-exported
├── infra/
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   ├── docker-compose.yml
│   └── nginx.conf
├── pnpm-workspace.yaml
└── package.json
```

**Dependency direction:** `web` → `shared` ← `api`. `web` never imports from `api`; both share Zod contracts via `shared`.

## 3. API request lifecycle

```
request
  → plugin: CORS
  → plugin: authContext   (v1: injects the seeded user; later: verifies session/JWT)
  → route handler         (Zod-validates params/body via fastify-type-provider-zod)
  → service               (authorization: can this user see/edit this entity?)
  → repository             (Drizzle query against SQLite)
  → service               (shape response)
  → route                 (Zod-validated response serialization)
  → plugin: error handler (maps AppError → HTTP status + JSON problem body)
response
```

- **Authorization seam:** every service method takes `(ctx: { userId }, ...args)`. v1 `ctx.userId` is always the seeded user. Adding auth later only changes the `authContext` plugin — services and repositories are untouched.
- **Visibility helper:** `repositories/visibility.ts` exposes `visibleTodoIds(userId)` etc. (owner OR assignee OR project member OR direct collaborator). Used by every list/read query.

## 4. Configuration

- `.env` per app (`API_PORT`, `DATABASE_URL`, `SEED_USER_EMAIL`, `WEB_ORIGIN`, later `GOOGLE_CLIENT_ID`…).
- `apps/api/src/config.ts` parses `process.env` with Zod and fails fast on missing required vars.
- No secrets committed. `.env.example` documents every key.

## 5. Dynamic sitemap

- Route `GET /api/sitemap.xml` (served at `/sitemap.xml` via nginp rewrite).
- Builds `<url>` entries from:
  - static routes: `/`, `/calendar`, `/todos`, `/incoming`, `/learn`, `/projects`
  - `SELECT id, updated_at FROM projects` → `/projects/:id`
  - each todo / event / reference detail route
  - each tag → `/learn?tag=:slug` and `/todos?tag=:slug`
- `lastmod` from `updated_at`. Response cached in memory for 5 minutes (invalidated on any write via a bump counter).
- `robots.txt` served statically, pointing at the sitemap.
- Client-side: React Router routes mirror the sitemap; a small `routeManifest.ts` keeps them in sync and is the single place new dynamic route patterns are registered.

## 6. Cross-cutting concerns

| Concern | Approach |
|---|---|
| IDs | `crypto.randomUUID()` (or `cuid2`) generated in the repository layer; text PKs. |
| Timestamps | epoch ms (UTC integer) in DB; ISO strings over the wire; formatted client-side in the user's timezone. |
| Errors | `AppError` subclasses (`NotFound`, `Forbidden`, `Validation`, `Conflict`) → RFC 7807-ish JSON. |
| Logging | Fastify's pino logger; request id on every log line. |
| Soft vs hard delete | **Hard delete + `activity_log` entry** (resolved A5). |
| Migrations | `drizzle-kit generate` → committed SQL; `migrate()` on API boot; fail startup on error. |
| Testing | Vitest; API tested via `app.inject()` against an in-memory SQLite DB seeded per suite. |
| Time source | `lib/clock.ts` wrapper so tests can freeze time. |
