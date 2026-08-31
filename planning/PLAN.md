# STOMP — Master Plan

> Personal + shared hub: **calendar · todos · incoming · learn**, grouped by **projects**, with a tiled home and a "hot & relevant" sidebar. Local-first, SQLite, containerized, deployable cheaply later.

This document is the spine. Each section links to the ICM stage that owns the detail. Read stages in order; there is a human review gate between each.

---

## 0. Status

**Planning updated with user answers to A1–A9 + D1–D4 (2026-08-31). `StompList/` deleted (this repo replaces it). `ui-ux-pro-max` + `ui-styling` skills installed; skill bundle pruned; Python 3 installed; design system generated & reconciled at [`design-system/stomp/MASTER.md`](../design-system/stomp/MASTER.md); Stage 03 re-run against it. Non-blocking open items: D5 (final brand color), B/C sets. Phase 0 build can start on the owner's go.**

## 1. Confirmed decisions (user, 2026-08-31)

| # | Decision |
|---|---|
| Hosting | Local development first (Docker container fine); cheap hosting later. |
| Datastore | SQLite (libSQL/Turso-compatible). → [ADR-0002](_config/decisions/adr-0002-datastore.md) |
| Calendar | Own event store in v1; two-way Google sync is a later phase. |
| Auth | Multi-user + sharing **in the schema now**; seeded users, no login screen in v1 (API acts as user #1). Home has a "create account" entry point; real signup is Phase 3. |
| Workspaces | Own entity with members; `workspace_id` **nullable** on all scoped tables (personal = `NULL`). Visibility flows through projects; per-item grants on top. → [ADR-0003](_config/decisions/adr-0003-workspaces-and-sharing.md) |
| Sharing | Per-type collaborator tables (`todo_/event_/reference_collaborators`); polymorphism only for `taggings` + `activity_log`. |
| Subtasks | `parent_todo_id`; inherit parent's workspace + project; own status/priority/dates/assignee; not shareable independently. |
| References | Tagged link library in v1; tracking / groups / topics / spaced-repetition backlogged. |
| Incoming | One inbox for quick-capture + items shared to you (accept/decline). |
| Notifications | `notifications` table reserved now; producers + surface land Phase 2+. |
| Email/Gmail | Design schema + adapter interface now; build later. |
| Projects | Group **all** item types; personal or workspace-scoped; shareable. |
| Recurrence | Backlogged; `events.rrule` reserved; additive path documented (schema §7) so we're not cornered. |
| Delete | Hard delete + `activity_log`. No soft delete. |
| Today's build | PRD + SQLite schema + API CRUD for all sections + minimal UI (Phase 0). |
| Stack | TS · Fastify · Drizzle · SQLite · Zod · Vite/React · Tailwind + shadcn/ui · pnpm monorepo · Docker. → [ADR-0001](_config/decisions/adr-0001-stack.md) |
| Sidebar | High-priority open todos + due-today + overdue + un-triaged incoming. |

## 2. The plan, by stage

| Stage | What it decides | Link |
|---|---|---|
| 00 PRD | Problem, goals/non-goals, personas, user stories, functional + non-functional requirements, success criteria, milestones | [prd.md](00-prd/output/prd.md) |
| 01 Architecture | Runtime topology, monorepo layout, API layering, config, dynamic sitemap | [architecture.md](01-architecture/output/architecture.md) |
| 02 Data model | **The schema** — 19 tables, workspace + sharing/visibility model, "today" query, Drizzle sketch | [schema.md](02-data-model/output/schema.md) |
| 03 UI/UX | Route tree, screen inventory, home layout, landing pages, components + **design system** | [ui-ux.md](03-ui-ux/output/ui-ux.md) · [MASTER.md](../design-system/stomp/MASTER.md) |
| 04 Integrations | Adapter interfaces, v1-stub vs later-live matrix, OAuth + sync loop design | [integrations.md](04-integrations/output/integrations.md) |
| 05 Delivery | 6 phases (0 = today), exit criteria, dogfood backlog | [roadmap.md](05-delivery/output/roadmap.md) · [backlog.md](05-delivery/output/backlog.md) |
| 06 Gaps & questions | Every unconfirmed decision — **the review gate** | [open-questions.md](06-gaps-and-questions/output/open-questions.md) |

## 3. Entities at a glance (see [schema.md](02-data-model/output/schema.md) for full detail)

`workspaces` · `workspace_members` · `users` · `projects` · `project_members` · `todos` (self-ref subtasks) · `events` · `event_attendees` · `references` · `tags` · `taggings` (polymorphic) · `incoming_items` · `notifications` *(reserved)* · `todo_collaborators` / `event_collaborators` / `reference_collaborators` · `integration_accounts` *(reserved)* · `sync_log` *(reserved)* · `activity_log`.

## 4. What gets built in Phase 0 (today, post-approval)

Monorepo scaffold · full Drizzle schema (19 tables incl. workspaces + collaborator tables + reserved notifications) + migration · seed (2 users, shared workspace + project, demo items) · Fastify CRUD for all sections + subtasks + triage + workspace/member APIs + `/home/summary` + `/home/hot` + dynamic `/sitemap.xml` · visibility helper + tests · React `AppShell` (banner + tiles + hot sidebar + "Create account" stub) · landing page per section on real data · todo & project create/edit/delete · Docker Compose · GitHub Actions CI. Exit: `docker compose up` → working hub, data persists, CI green.

## 5. What is explicitly NOT in Phase 0

Login/auth UI (only a "Create account" stub link) · workspace switcher & sharing UI · notifications producers/panel · live Gmail/Calendar calls · recurring items · reference progress tracking · mobile/PWA polish · search. All are schema-ready or interface-ready; see [roadmap.md](05-delivery/output/roadmap.md).

## 6. Open questions

Section A (A1–A9) is **resolved** — see [open-questions.md](06-gaps-and-questions/output/open-questions.md) and [schema §8](02-data-model/output/schema.md). Remaining: tag-scope edge cases, notifications scope (Phase 2), and the B (auth) / C (integrations) sets — all answerable as their phase approaches. Plus two logistics items: the "UI UX Pro Max" skill source, and whether STOMP builds inside the existing `StompList/` repo.
