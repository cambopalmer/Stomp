# STOMP — Architecture

> **See also:** [`c4-model.md`](c4-model.md) — the C4 model (Context / Container / Component /
> Code) with an interactive click-through version in [`c4-model.html`](c4-model.html). This
> document is the prose companion: deployment, layering rules, and cross-cutting conventions.

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

- **Local dev:** Vite on `:5173` proxies `/api` to Fastify on `:3000`; SQLite file in
  `apps/api/.data/stomp.db`. On Windows run the two dev servers separately — the combined
  `pnpm dev` can hang the API under `tsx watch`.
- **Container:** two images. `web` (nginx) serves the built SPA and reverse-proxies `/api`,
  `/sitemap.xml`, `/robots.txt` to `api`. `api` runs migrations on boot, then listens. The
  SQLite file lives on the `stomp-data` named volume.
- **Later hosting:** push both images to a registry; deploy to Fly.io / Render / Railway, or a
  small VPS. DB → Turso (hosted libSQL) or a mounted volume — a `DATABASE_URL` change (ADR-0002).

## 2. Monorepo layout

```
STOMP/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── routes/          # HTTP layer — thin: Zod-validate, call a service
│   │   │   ├── services/        # business logic + authorization; call Drizzle directly
│   │   │   │   └── access.ts     # the visibility model (ADR-0003)
│   │   │   ├── plugins/         # authContext, googleOAuth, errorHandler
│   │   │   ├── db/
│   │   │   │   ├── schema.ts     # Drizzle table definitions — source of truth (20 tables)
│   │   │   │   ├── client.ts     # libSQL connection + Drizzle singleton
│   │   │   │   ├── migrate.ts    # runs committed migrations on boot
│   │   │   │   └── seed.ts       # demo data + seed accounts (pamcalmer dev-only)
│   │   │   ├── lib/              # sitemap, logger, cookies, errors, ids, clock
│   │   │   ├── instrumentation.ts # OpenTelemetry bootstrap (imported first)
│   │   │   ├── app.ts            # buildApp() — plugin registration order
│   │   │   └── server.ts
│   │   ├── drizzle/              # generated SQL migrations (committed)
│   │   └── drizzle.config.ts
│   └── web/
│       ├── src/
│       │   ├── routes/           # one component per screen + Login
│       │   ├── components/       # AppShell + forms/editors + ui.tsx primitives
│       │   ├── lib/              # api client, query hooks, auth/workspace/theme contexts
│       │   ├── App.tsx           # route table + auth gate
│       │   └── main.tsx          # provider tree
│       └── index.html
├── packages/
│   └── shared/
│       └── src/                  # Zod schemas + inferred DTO types per domain
│                                 # (auth.ts, todo.ts, …) re-exported from index.ts
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
  → plugin: CORS (locked to WEB_ORIGIN) + cookie
  → plugin: authContext   (unsign stomp_session → session + user → request.ctx; 401 non-public)
  → route handler         (Zod-validates params/body via fastify-type-provider-zod)
  → service               (authorization: can this user see/edit this entity?)
  → Drizzle                (parameterized query against libSQL/SQLite)
  → service               (write activity_log on mutations; shape response)
  → route                 (Zod-validated response serialization)
  → plugin: error handler (maps AppError → HTTP status + JSON problem body)
response
```

- **Authorization seam:** every service function is `(db, ctx: { userId }, ...args)`. Phase 3
  swapped `authContext` from a seeded-user shim to real session resolution — services and data
  access were untouched. `AUTH_TEST_BYPASS=true` keeps the test suites running as the seed user.
- **Visibility model:** `services/access.ts` (ADR-0003) — `accessibleProjectIds()` (owns OR
  project_member OR workspace_member), `projectAccess()` (stronger of workspace and project
  role), `assertWorkspaceMember()`. Called by every list / read / mutate.

## 4. Configuration

- `.env` at the repo root (loaded by `apps/api`) + `apps/web` `VITE_`-prefixed vars.
- `apps/api/src/config.ts` parses `process.env` with Zod and `process.exit(1)` on invalid input.
  Production hard-fails on the default `SESSION_SECRET`; `db:seed` hard-fails in production on the
  default `SEED_USER_PASSWORD`.
- No secrets committed. `.env.example` documents every key; `docs/GOOGLE-OAUTH.md` walks the
  optional OAuth setup.

## 5. Auth (Phase 3)

- **Session**: `sessions` table (random 256-bit token = the cookie value, 30-day TTL,
  server-revocable). Signed httpOnly `stomp_session` cookie (`@fastify/cookie`, `SESSION_SECRET`).
- **Password**: argon2id (`@node-rs/argon2`); login verifies against a constant dummy hash when
  the email is unknown so timing doesn't leak account existence.
- **Google OAuth** (`@fastify/oauth2`): no-op unless `GOOGLE_CLIENT_ID`/`SECRET` are set. Links to
  an existing account by verified email, else creates one — both the password and OAuth paths go
  through `assertSignupAllowed()` (`ALLOW_SIGNUP`, first user always allowed).
- **`authContext`** resolves the cookie on every request and 401s anything not on the public
  allow-list (`/api/health`, `/api/auth/*`, `sitemap.xml`, `robots.txt`).

## 6. Dynamic sitemap

- **Public** `GET /api/sitemap.xml` — static routes only. STOMP is a private hub, so per-item
  URLs would leak other users' data.
- **Authenticated** `GET /api/sitemap-me.xml` — the caller's own todos / events / references /
  projects (`buildUserSitemap` in `lib/sitemap.ts`).
- `robots.txt` is `Disallow: /`. nginx maps `/sitemap.xml` and `/robots.txt` to the API.

## 7. Cross-cutting concerns

| Concern | Approach |
|---|---|
| IDs | text uuid PKs, generated in app code (`lib/ids.ts`). |
| Timestamps | epoch-ms UTC integers named `*_at` in DB; formatted client-side in the user's timezone. |
| Enums | `text` + Drizzle `{ enum: [...] }` — TS-only, no DB CHECK constraint (flagged in code review). |
| Errors | `AppError(status, code, message)` (`NotFound` / `Forbidden` / `BadRequest` / `Conflict`) → JSON problem body via the `errorHandler` plugin. |
| Logging | pino instance (`lib/logger.ts`): `LOG_LEVEL`, credential redaction, `trace_id`/`span_id` mixin; pino-pretty as a sync stream in dev. |
| Tracing | OpenTelemetry, `OTEL_MODE` = off (default) / console / otlp. `instrumentation.ts` imported first in `server.ts`. See `docs/OBSERVABILITY.md`. |
| Delete | **Hard delete + `activity_log` row** (A5). `services/cleanup.ts` purges polymorphic refs. |
| Migrations | `drizzle-kit generate` → committed `drizzle/*.sql`; `runMigrations()` on API boot; fail startup on error. |
| Testing | Vitest + Fastify `app.inject()` (45+ API tests); Playwright e2e over the real stack (16 tests). |
| Time source | `lib/clock.ts` wrapper so tests can freeze time. |
