# Changelog

All notable changes to STOMP. Format per [Keep a Changelog](https://keepachangelog.com/);
versioning per [SemVer](https://semver.org/). Pre-1.0: minor = feature milestone
(≈ a phase), patch = fixes within one. Releases from **v0.4.0** onward are cut by
[release-please](https://github.com/googleapis/release-please) from Conventional Commits.

## [0.4.0](https://github.com/cambopalmer/Stomp/compare/v0.3.0...v0.4.0) (2026-10-09)


### ⚠ BREAKING CHANGES

* **db:** users.auth_provider and users.auth_provider_id are removed. Nothing in the app used them; external SQL that did will fail.

### Features

* **admin:** Tools & links panel — data browser, architecture map, Google Cloud console ([1a10f54](https://github.com/cambopalmer/Stomp/commit/1a10f540bcd12fbfd9b144a9853f51b9ffb4b7ae))
* **architecture:** pan + zoom on the C4 diagrams ([9a57e70](https://github.com/cambopalmer/Stomp/commit/9a57e702e347991d3c72587046a299b932f3e24e))
* **auth:** Google OAuth + email/password sessions ([97250ae](https://github.com/cambopalmer/Stomp/commit/97250aeceace26de85e1c0beb3b9b0c95facbee6))
* hub admin role (user management) + delete-as-anonymize ([335c7c9](https://github.com/cambopalmer/Stomp/commit/335c7c976f695a94186d315270b29104d0d5b445))
* **integrations:** background sync every 10 min + sync history (Phase 4, slice 4) ([98d6730](https://github.com/cambopalmer/Stomp/commit/98d673093fd07a289fa91a17946d08741b1575da))
* **integrations:** connect Google accounts (Phase 4, slice 1) ([3ce17fb](https://github.com/cambopalmer/Stomp/commit/3ce17fb8dce5abec8cfb6e7a81d2c1257af0d534))
* **integrations:** Gmail → Incoming (Phase 4, slice 3) ([94eed30](https://github.com/cambopalmer/Stomp/commit/94eed30568e47fb48fe9aa158a003dfbc1b5da08))
* **integrations:** Google Calendar import (Phase 4, slice 2) ([f6a5c79](https://github.com/cambopalmer/Stomp/commit/f6a5c791ebff81d947fcea4e96ec5d5329d8a514))
* **obs:** structured logging + OpenTelemetry tracing ([ef1d2f8](https://github.com/cambopalmer/Stomp/commit/ef1d2f83e725cd1416d9a265ddea4f94b54f1114))
* **planner:** anchored "Add before…" prep blocks (Phase 4.5, slice 5) ([0d29b6e](https://github.com/cambopalmer/Stomp/commit/0d29b6e7f0a40844ff9983669823bbaea5168f13))
* **planner:** copy a day, Home Now/Next, admin default categories, installable app (Phase 4.5, slice 6) ([b1dbf33](https://github.com/cambopalmer/Stomp/commit/b1dbf33d4cc95d5bf50633fc418a920f9a8cdc80))
* **planner:** data model + API foundation (Phase 4.5, slice 1) ([7db7866](https://github.com/cambopalmer/Stomp/commit/7db7866b027ab4e98cb3408ca5a7f84bb5bdf768))
* **planner:** mobile-first day view (Phase 4.5, slice 2) ([3bceaa5](https://github.com/cambopalmer/Stomp/commit/3bceaa5bc506826fca9bc7f8b4145e1698444d43))
* **planner:** review, notes, totals + drag / long-press / keyboard editing (Phase 4.5, slice 4) ([5033ee5](https://github.com/cambopalmer/Stomp/commit/5033ee59e332aa1e90844e1389be4f1c7c45a123))
* **planner:** todos on the planner — tray, linked blocks, "also complete?" (Phase 4.5, slice 3) ([ead5a27](https://github.com/cambopalmer/Stomp/commit/ead5a278ec7695cf080defc8e1fb4f73cedfae85))
* **web:** ☰ menu for phones and small tablets ([a476552](https://github.com/cambopalmer/Stomp/commit/a476552034ca2cb169c0cbe8897f62da82f45a86))
* **web:** calendar month / week / list views ([7442be4](https://github.com/cambopalmer/Stomp/commit/7442be4fd8561f0458fda19dd48bc6deb14b4720))
* **web:** serve the C4 architecture map at /architecture.html ([c6ba6bc](https://github.com/cambopalmer/Stomp/commit/c6ba6bc03f936b33b57788f7801559c516cd5adc))
* **web:** todos on the calendar + Show filter (all / events / todos) ([874040d](https://github.com/cambopalmer/Stomp/commit/874040d98f8c4494f8a78215e4647795890df64c))


### Bug Fixes

* **api:** deleting a todo now deletes its subtasks ([47e02d5](https://github.com/cambopalmer/Stomp/commit/47e02d5cf35cc9240aada283dc35840ee78d5e79))
* **api:** SQLite WAL + busy_timeout, and FK enforcement in tests too ([776adeb](https://github.com/cambopalmer/Stomp/commit/776adeb48989f5d48246018f0ccc065b75985430))
* **architecture:** C4 diagrams were rendering blank; polish the notation ([8046c17](https://github.com/cambopalmer/Stomp/commit/8046c17d40a944de8cd721ebfc50ad57b3817173))
* **auth:** close the two MEDIUM security-review findings ([c26f616](https://github.com/cambopalmer/Stomp/commit/c26f6163b4993af112b3fc41e2959b5f727ef605))
* **ci:** drop duplicate pnpm version so action-setup uses packageManager ([8bb97eb](https://github.com/cambopalmer/Stomp/commit/8bb97ebc538129182dcb11e9311dabbb282c8648))
* **deps:** drizzle-orm 0.36 → 0.45.2 (SQL-identifier injection advisory) ([2a103a3](https://github.com/cambopalmer/Stomp/commit/2a103a34a91d9b998c2126ae4127a7b8c41dbbc7))
* **deps:** security sweep — 35 audit advisories down to 1 ([f973895](https://github.com/cambopalmer/Stomp/commit/f9738956a8ee4d602fa712a4f32df26b52246016))
* **infra:** API image build — drop pnpm-10-only --legacy flag from deploy ([4ca8156](https://github.com/cambopalmer/Stomp/commit/4ca8156b3a42d5352ec1575d975bf2b6b8cd86ec))
* **integrations:** scope calendar mirrors per connection; ask to keep them on disconnect ([aff9f62](https://github.com/cambopalmer/Stomp/commit/aff9f62af1abd5300dfa6d3f3f7171c1d42f6758))
* **planner:** open an hour before now (today) / 8 am (other days); fix scroll race ([e5d2623](https://github.com/cambopalmer/Stomp/commit/e5d2623f929a4c2b9733491ea71f1f0f95da3987))


### Refactoring

* **db:** drop legacy users.auth_provider / auth_provider_id ([fbaeab9](https://github.com/cambopalmer/Stomp/commit/fbaeab93329c703655459ad266b6d1c38e17948b))


### Tests

* **e2e:** make the Home Now/Next test independent of the time of day ([686aae4](https://github.com/cambopalmer/Stomp/commit/686aae4868739f24ee946859ede90a59a3b4620b))


### Documentation

* **adr:** ADR-0006 day planner design + build slices ([d201b1b](https://github.com/cambopalmer/Stomp/commit/d201b1b001feb0ee7f9a3a4c78ae392febb8d9b2))
* **architecture:** C4 model + interactive click-through map ([e17d93e](https://github.com/cambopalmer/Stomp/commit/e17d93e3fb07f4056666d525ab227443de0a1fe0))
* **architecture:** redraw the C4 map in conventional C4 notation ([c4bfd10](https://github.com/cambopalmer/Stomp/commit/c4bfd103a2703bc08f6232318fbe698678b9e0a8))
* **auth:** Google OAuth guide for the 2025 console + Phase 4 prerequisites ([f375140](https://github.com/cambopalmer/Stomp/commit/f37514077124b3e40c81c618ec77f3eb6cb71274))
* backlog the deferred dependency-upgrade sweep ([f0b3ec5](https://github.com/cambopalmer/Stomp/commit/f0b3ec54f1a62f398b69bd772d1e2339a9e5e27e))
* **backlog:** admin panel tools & links (data browser, architecture map, Google console) ([f3420e8](https://github.com/cambopalmer/Stomp/commit/f3420e887d465b46a1d5b6550be700a1b399de6e))
* Google OAuth setup walkthrough ([9693005](https://github.com/cambopalmer/Stomp/commit/96930055a408e0a9bbe0a7231a871bd2f10bb5a3))
* mark Phase 3 merged; note trunk-only branch policy ([6ca9422](https://github.com/cambopalmer/Stomp/commit/6ca9422cb86c07f75cf1dd96d060fe85cf6e0a8f))
* **roadmap:** Phase 4.5 day planner — problem statement + owner direction ([143d14c](https://github.com/cambopalmer/Stomp/commit/143d14c76e4194ec45b34d8a0228a2c87dff298b))
* tick shipped Phase 0 backlog items; WAL/busy_timeout still open ([f6f74f3](https://github.com/cambopalmer/Stomp/commit/f6f74f343c8a08fca07fa6ac143daf2014cab64a))


### Build & CI

* Node 20 (EOL) → 24 in CI + Docker; engines &gt;=22.12 ([51332fc](https://github.com/cambopalmer/Stomp/commit/51332fcc28cd7d9856de9749c17023f2847c815c))
* **web:** Tailwind CSS 3 → 4 — clears the last audit advisories ([40fa4cf](https://github.com/cambopalmer/Stomp/commit/40fa4cfcfe45271aebbae24cd3cc66da34af64be))

## [0.3.0] — 2026-09-02 — Phase 2: Workspaces, sharing & notifications

### Features
- Workspaces: nullable-scope model, active-workspace switcher, `/workspaces`
  management (create, members by email), all lists + the Home tiles/sidebar
  scoped to the active workspace.
- Sharing: per-item collaborator UI on todo/event/reference detail (add by email,
  role, remove); `/shared` "Shared with me" view.
- Assignee picker on todos (workspace members, membership enforced).
- Notifications: banner bell + panel with unread count; stored producers
  (`share_invite`, `assignment`); computed-on-read `past_due` + `event_reminder`.
- Accept / Decline on shared items in Incoming (decline revokes your access).

### Bug Fixes / Performance (from `/code-review` + `/security-review`)
- RHF forms silently dropped `register()` refs (`Input`/`Select`/`Textarea` not
  `forwardRef`) — every create/edit form failed validation.
- Hot-list sorted priority alphabetically, not by urgency.
- Home / notifications event queries missed collaborator-shared events.
- Hard delete left orphan `taggings` rows.
- `tags.workspace_id` was `ON DELETE CASCADE` → `SET NULL` (migration 0001).
- Subtask cascade re-applied the old project/workspace when clearing a parent's.
- `updateTodo` assignee validation ignored a workspace re-scope.
- `listCollaborators` had no authorization (IDOR — collaborator emails).
- Cross-workspace share notice was unreachable for the recipient.
- Re-sharing wasn't idempotent (duplicate inbox items + notifications).
- `sharedWithMe` and `homeSummary` did full-table scans / redundant queries.

### Tests
- Playwright e2e suite (12 tests over the real stack), wired into CI.
- API test suite grown to 38.

## [0.2.0] — 2026-08-31 — Phase 1: Fill the UI

### Features
- Detail/edit screens for todos (incl. subtasks, tags, activity log), events,
  references. Project detail with Todos/Events/References/Incoming tabs.
- Tag pages (`/tags/:name`), landing-page filters, dark-mode toggle.
- Consistent loading / error / empty states.
- Brand palette switched to indigo + emerald.

## [0.1.0] — 2026-08-31 — Phase 0: Foundation

### Features
- pnpm monorepo (`apps/api`, `apps/web`, `packages/shared`).
- Drizzle schema (19 tables) + migrations + seed; libSQL/SQLite.
- Fastify API: CRUD for all sections, triage, `/home/*`, dynamic `/sitemap.xml`;
  visibility/sharing model; single seeded user (auth deferred to Phase 3).
- React shell: banner + tiles + hot sidebar; a landing page per section.
- Docker Compose + GitHub Actions CI.

[0.3.0]: https://github.com/cambopalmer/Stomp/releases/tag/v0.3.0
[0.2.0]: https://github.com/cambopalmer/Stomp/releases/tag/v0.2.0
[0.1.0]: https://github.com/cambopalmer/Stomp/releases/tag/v0.1.0
