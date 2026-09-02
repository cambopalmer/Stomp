# STOMP — external review brief

> For a reviewer (Codex, another model, or a person) doing an independent pass over the plan and the code. Read this first — it tells you where to look and what *not* to flag.

## What STOMP is

A self-hostable hub for **calendar, todos, an incoming triage inbox, and a learn library**, grouped by **projects** inside optional **workspaces** that a small circle of people share. TypeScript throughout: Fastify + Drizzle + libSQL/SQLite API, Vite + React + Tailwind SPA, pnpm monorepo, Docker.

Solo project, built in phases. Phases 0–2 are done and on `main`. Phase 3 (auth) is next and deliberately not started.

## Where things are

### The plan
- `planning/PLAN.md` — spine, links everything
- `planning/00-prd/output/prd.md` — goals, personas, requirements
- `planning/01-architecture/output/architecture.md` — stack, topology, layering
- `planning/02-data-model/output/schema.md` — **the schema** (19 tables), visibility model, "today" query
- `planning/03-ui-ux/output/ui-ux.md` + `design-system/stomp/MASTER.md`
- `planning/04-integrations/output/integrations.md` — email/calendar adapters (designed, not built)
- `planning/05-delivery/output/roadmap.md` + `backlog.md` — phase plan + checklist
- `planning/06-gaps-and-questions/output/open-questions.md` — resolved + still-open decisions
- `planning/_config/decisions/adr-000{1..4}.md` — stack, datastore, workspaces+sharing, design tooling

### The code
| Path | What |
|---|---|
| `apps/api/src/db/schema.ts` | Drizzle schema — source of truth |
| `apps/api/src/services/access.ts` | **authz core**: `accessibleProjectIds`, `projectAccess`, `assertWorkspaceMember` |
| `apps/api/src/services/*.ts` | one per resource — business logic + per-entity visibility filters |
| `apps/api/src/routes/index.ts` | HTTP layer (Fastify + zod) |
| `apps/api/src/plugins/authContext.ts` | **the auth seam** — hardcodes the seeded user today |
| `apps/api/src/lib/{sitemap,day,errors,sitemap}.ts` | helpers |
| `apps/web/src/lib/queries.ts` | TanStack Query hooks + the `mutation()` factory + `useWsPath` |
| `apps/web/src/lib/workspace.tsx` | active-workspace context |
| `apps/web/src/components/`, `apps/web/src/routes/` | UI |
| `apps/web/e2e/` | 12 Playwright tests over the real stack |

## Run it

```bash
pnpm install
cp .env.example .env
pnpm --filter @stomp/api db:seed     # 2 users, a shared "Household" workspace, demo data
pnpm dev                              # api :3000, web :5173
pnpm test                             # 32 API tests + 4 shared-schema tests
pnpm --filter @stomp/web e2e          # 12 Playwright tests (starts its own seeded stack)
pnpm typecheck && pnpm build
```

## Do NOT flag these — they are intentional / already tracked

1. **No authentication.** `authContext` hardcodes the seeded user. That is Phase 3. The app is not deployed. `robots.txt` is `Disallow: /`.
2. **`GET /sitemap.xml` lists every user's ids.** Known — `TODO(auth, Phase 3)` in `lib/sitemap.ts`, in the backlog.
3. **No email/calendar integration.** Designed in `04-integrations`, tables reserved, no live code — Phase 4/5.
4. **`notifications` table has few producers.** `share_invite` + `assignment` are stored; `past_due` + `event_reminder` are computed on read (no scheduler by design). Recurrence (`rrule`), reference progress tracking, etc. are backlog.
5. **Last-write-wins on shared items.** No optimistic concurrency yet — noted in open-questions §E.
6. **`workers: 1` / serial e2e, DB reseeded once per run.** Intentional for SQLite.
7. **`.env.example` values, seeded emails (`owner@stomp.local`).** Dev fixtures.
8. Web has **no unit/component tests** — only e2e. Known gap.

## Where a second opinion is most valuable

### Plan / architecture
- **Nullable `workspace_id` everywhere** (personal = `NULL`, ADR-0003). Is this going to be a recurring source of bugs vs. an always-present "personal workspace" row? Every list query has a 3-way `undefined | null | id` filter.
- **Visibility model** (`services/access.ts` + per-entity `visible()` helpers): item visible if `createdBy OR assignee OR accessible-project OR collaborator`. Is it complete? Any way to see something you shouldn't, or *not* see something you should?
- **"Effective role = stronger of workspace role and per-project role."** Right call, or surprising?
- **Subtask inheritance** (child todo inherits parent's `workspace_id` + `project_id`) is enforced in the service layer, not the DB. Cascade on parent re-scope is a separate `UPDATE`. Failure modes?
- **Per-type collaborator tables** (`todo_/event_/reference_collaborators`) vs the polymorphic `taggings` / `activity_log` / `notifications.entity_id` (no FK, app-enforced). Consistent enough? IDOR risk on the polymorphic ones?
- **libSQL/SQLite** for a multi-user shared app. Realistic ceiling? Migration path to Turso/Postgres is claimed to be a connection-string change — is it?
- **Hard delete + `activity_log`** vs soft delete. Regret risk?

### Implementation
- **The `authContext` seam.** Claim: swapping this one plugin is all Phase 3 needs, services untouched. Is that true, or do routes/services assume single-user anywhere (e.g. `req.currentUser.timezone`, the seeded-user cache in the plugin)?
- **Visibility logic is duplicated** across `todos.ts`, `events.ts`, `references.ts`, `home.ts` — each has its own `visible()`/`visibleTodoConds()`. Correctness drift risk; worth consolidating?
- **`accessibleProjectIds`** issues 2 queries then a left-join per request; called by most list endpoints. N+1 / perf at, say, 10 users × 500 items?
- **`or(cond, sql\`0\`)`** idiom for empty `inArray` lists (drizzle chokes on empty `inArray`). Cleaner way?
- **TanStack Query invalidation** invalidates by broad key prefix on every mutation (`WRITE_KEYS`). Over-fetching? The `mutation()` factory in `queries.ts` — sound pattern?
- **Notifications computed-on-read**: `past_due` / `event_reminder` are synthesized each call, can't be marked read, no dedup. Acceptable, or does it need materializing?
- **Build story**: dev imports `@stomp/shared` as source; the API Docker image esbuild-bundles it (`apps/api/build.mjs`), libsql kept external. Fragile?
- We just found a bug where `Input`/`Textarea`/`Select` weren't `forwardRef` so RHF's `register` ref was dropped — **are there other "component silently drops a prop" issues?**
- Error handling / status-code consistency across `routes/index.ts` + `plugins/errorHandler.ts`.

### Tests
- What are the highest-value missing e2e / integration tests?
- The API tests reseed per file via `beforeAll(seed)` — any isolation problems?

## Output we want

Findings grouped as **plan-level** vs **code-level**, each with file/line, severity, and a concrete recommendation. Flag anything that will make **Phase 3 (auth) or multi-user use** harder than the plan assumes.
