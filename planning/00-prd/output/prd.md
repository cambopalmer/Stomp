# STOMP — Product Requirements Document

**Working title:** STOMP — *Short Term Outside Memory Planner*
**Status:** Draft for review · 2026-08-31
**Owner:** Cambo Palmer
**Related:** [architecture](../../01-architecture/output/architecture.md) · [schema](../../02-data-model/output/schema.md) · [UI/UX](../../03-ui-ux/output/ui-ux.md) · [design system](../../../design-system/stomp/MASTER.md) · [roadmap](../../05-delivery/output/roadmap.md) · [open questions](../../06-gaps-and-questions/output/open-questions.md)

---

## 1. Summary

A lightweight, self-hostable hub that unifies the things a person tracks day to day — **calendar, todos, an incoming triage inbox, and a learn library** — grouped by **projects**, inside optional **workspaces** that let a small circle of people share work. The home screen is a banner + a tile per section + a persistent "hot & relevant" sidebar that answers *"what needs me now?"* across everything.

Local-first (SQLite, one container), designed schema-complete so multi-user, sharing, and email/calendar sync slot in later without destructive migration.

## 2. Problem

Personal organization is smeared across a calendar app, a to-do app, an email inbox, and a bookmark pile. No single surface shows what actually matters *today*, and there's no clean way to share a slice of it (a project, a few tasks, an event) with another person without adopting a heavyweight team tool.

## 3. Goals

| # | Goal | Measure |
|---|---|---|
| G1 | One surface for calendar + todos + incoming + learn | All four reachable from home in one click; each has its own landing page |
| G2 | Instant "what needs me now" | Hot sidebar shows overdue / urgent / due-today / un-triaged, correct within one refresh |
| G3 | Fast capture, deferred sorting | Quick-add from anywhere → lands in Incoming in < 2s, no forced categorization |
| G4 | Shareable without a team tool | A project (and its items) shared with another user via workspace or per-item grant |
| G5 | Self-hostable and portable | `docker compose up` → working hub; datastore is a single file |
| G6 | Future-proof schema | Auth, sharing UI, and Gmail/Calendar sync add columns/tables only — no data migration |

## 4. Non-goals (v1) / Out of scope

- **Non-goals now, planned later:** real auth & login UI, sharing management UI, Gmail pull, Google Calendar import, two-way calendar sync, sending email/invites, recurring items, notifications delivery, reference progress tracking / topics / spaced-repetition, mobile/PWA/offline, search.
- **Out of scope entirely:** full email client (threading, label management), real-time collaborative editing, native mobile apps, multi-tenant SaaS / billing / org administration, i18n.

## 5. Personas

| Persona | Description | Needs |
|---|---|---|
| **Owner / power user** (primary) | Technical, .NET/SQL background, self-hosts, reads the code. | One controllable hub, fast capture, a trustworthy "today" view, eventual Gmail/Calendar pull. |
| **Shared collaborator** (secondary) | Partner / friend / coworker invited to a workspace or a project. | See and edit exactly what's shared, nothing else. Accept or decline items sent to them. |
| **Prospective user** (tertiary) | Lands on the home page before accounts exist. | A clear "create an account" entry point (flow built in Phase 3). |

## 6. User stories

### Calendar
- As a user, I can add / edit / delete an event and it persists.
- As a user, I can see today's schedule and the rest of the week at a glance.
- *(Later)* As a user, I can see events pulled from Google Calendar, marked read-only.

### Todos
- As a user, I can capture a task in seconds with just a title.
- As a user, I can set priority, a deadline (`due_at`), and/or a day I plan to do it (`scheduled_for`).
- As a user, I can break a task into subtasks that live in the same project/workspace but have their own status and assignee.
- As a user, I can assign a task to another member of a shared project.
- As a user, I can see what's overdue, due today, and high priority without hunting.

### Incoming (triage)
- As a user, I can dump a thought without deciding where it goes.
- As a user, I receive tasks/events others share to me and accept or decline them.
- *(Later)* As a user, I see emails pulled in as items I can convert to a todo or event.
- As a user, I can process the inbox to zero: each item becomes a todo/event or is dismissed.

### Learn library
- As a user, I can save a link with a title, note, and tags.
- As a user, I can mark my status with it: to-learn / learning / learned.
- As a user, I can filter by tag or status to pick what to study next.

### Projects & workspaces
- As a user, I can group any mix of todos, events, references, and incoming items under a project.
- As a user, I can keep a project personal or attach it to a workspace.
- As a user, I can invite another user to a workspace (or a single project) so they see its items.
- As a user, I can track this buildout as its own project with its remaining/deferred work.

### Home & sidebar
- As a user, I see a banner + one tile per section, each with a count and a few relevant items.
- As a user, I see a persistent "hot & relevant" sidebar ranked by urgency.
- As a user, every tile links to that section's landing page.
- As a prospective user, I see a way to create an account (flow lands in Phase 3).

## 7. Functional requirements

| ID | Requirement | Phase |
|---|---|---|
| FR-1 | CRUD for todos (incl. subtasks), events, references, projects, incoming items, tags | 0 |
| FR-2 | Triage: convert an incoming item to a todo or event, linking back to the source | 0 |
| FR-3 | Home summary endpoint (tile counts) + hot-sidebar endpoint (ranked cross-section) | 0 |
| FR-4 | Landing page per section rendering the user's visible data | 0 |
| FR-5 | Dynamic `sitemap.xml` covering static routes + every project / todo / event / reference / tag | 0 |
| FR-6 | Nullable `workspace_id` on all scoped entities; visibility helper enforced on every read | 0 (schema) |
| FR-7 | Seed data: 2 users, 1 shared workspace + project, demo items across all sections | 0 |
| FR-8 | Full edit/detail screens for events, references, incoming; todo subtask UI; landing-page filters | 1 |
| FR-9 | Workspace + per-item sharing UI; assignee picker; "shared with me" views | 2 |
| FR-10 | `incoming_item` generated when another user shares an item to you (accept/decline) | 2 |
| FR-11 | Notifications surface (upcoming events, past-due, needs-attention, share invites) | 2+ |
| FR-12 | Real authentication (Google OAuth and/or email+password) + signup/onboarding | 3 |
| FR-13 | Connect Google account; Gmail read-only pull → incoming; Calendar one-way import | 4 |
| FR-14 | Two-way calendar sync; send email; send calendar invites | 5 |

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | `docker compose up` from a clean clone yields a working hub; data survives restart. |
| NFR-2 | Typed end-to-end (TypeScript); shared request/response contracts (Zod) between API and web. |
| NFR-3 | Layered API (routes → services → repositories); DB access only in repositories. |
| NFR-4 | Authorization seam isolated to one plugin so Phase 3 auth doesn't touch services. |
| NFR-5 | SQLite in WAL mode with `busy_timeout`; `foreign_keys = ON`. |
| NFR-6 | Timestamps stored UTC epoch-ms; displayed in the user's timezone; "today" math unit-tested for DST. |
| NFR-7 | Migrations are additive and committed; file backup before migrate. |
| NFR-8 | CI (GitHub Actions): typecheck + test + build both container images on every push. |
| NFR-9 | No secrets committed; `.env.example` documents every key. |
| NFR-10 | Accessibility: WCAG 2.2 AA per `design-system/stomp/MASTER.md` §10 — contrast, keyboard nav, visible focus, reduced motion, color-not-only, form error handling. ARIA via Radix/shadcn primitives. |
| NFR-11 | Private by default: `robots.txt` `Disallow: /` until a public surface is intentionally added. |

## 9. Success criteria (first usable release / Phase 0 exit)

1. Fresh clone → `docker compose up` → hub at `localhost:8080`; data persists across `down`/`up`.
2. Owner can create, edit, and delete todos and projects; create events, references, incoming items.
3. Home tile counts and the hot sidebar are correct against seed data.
4. A todo `scheduled_for` today or overdue appears in the sidebar within one refresh.
5. `sitemap.xml` lists a URL for every project and item in the DB.
6. Adding auth + sharing later requires **no destructive migration** (verified by review of the migration set).
7. `pnpm test` green in CI.

## 10. Metrics (once multi-user / in real use)

- Time-to-capture (quick-add open → saved).
- Inbox-zero rate (share of days Incoming reaches 0).
- Sidebar accuracy (no "surprise" overdue items that weren't surfaced).
- Sync freshness (Phase 4+): median lag between Gmail receipt and Incoming appearance.

## 11. Milestones

| Milestone | Contents |
|---|---|
| **M0 — Foundation** (this build) | Schema, API CRUD, minimal UI, Docker, CI. See roadmap Phase 0. |
| **M1 — Usable UI** | Full detail/edit screens, filters, project detail, dark mode. Phase 1. |
| **M2 — Sharing** | Workspaces + per-item sharing live; notifications surface. Phase 2. |
| **M3 — Accounts** | Real auth, signup, invites. Phase 3. |
| **M4 — Inbound sync** | Gmail pull, Calendar import. Phase 4. |
| **M5 — Outbound** | Two-way calendar, send mail/invites. Phase 5. |

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| SQLite write contention with multiple active users | WAL + busy_timeout now; Turso/Postgres is the escape hatch (ADR-0002). |
| Scope creep from "design now, build later" | Reserved tables/columns only; no live integration code in v1. |
| Owner new to React/Tailwind/shadcn | Minimal UI in Phase 0; explicit polish-pairing in Phase 1. |
| Workspace visibility rules subtly wrong | Single `visibility.ts` helper; dedicated test suite covering personal / workspace / project-member / collaborator / guest cases. |
| "Today" boundary bugs across timezones/DST | `lib/day.ts` with frozen-clock tests. |
| Recurrence retro-fit | Additive path pre-documented in schema §7. |

## 13. Open issues

Tracked in [open-questions.md](../../06-gaps-and-questions/output/open-questions.md). Phase-0 blockers A1–A9 are resolved; remaining items are tag-scope edge cases, notifications scope (Phase 2), and the auth/integration question sets (B, C).
