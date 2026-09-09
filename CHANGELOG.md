# Changelog

All notable changes to STOMP. Format per [Keep a Changelog](https://keepachangelog.com/);
versioning per [SemVer](https://semver.org/). Pre-1.0: minor = feature milestone
(≈ a phase), patch = fixes within one. Releases from **v0.4.0** onward are cut by
[release-please](https://github.com/googleapis/release-please) from Conventional Commits.

## [0.4.0](https://github.com/cambopalmer/Stomp/compare/v0.3.0...v0.4.0) (2026-09-09)


### Features

* **architecture:** pan + zoom on the C4 diagrams ([9a57e70](https://github.com/cambopalmer/Stomp/commit/9a57e702e347991d3c72587046a299b932f3e24e))
* **auth:** Google OAuth + email/password sessions ([97250ae](https://github.com/cambopalmer/Stomp/commit/97250aeceace26de85e1c0beb3b9b0c95facbee6))
* **obs:** structured logging + OpenTelemetry tracing ([ef1d2f8](https://github.com/cambopalmer/Stomp/commit/ef1d2f83e725cd1416d9a265ddea4f94b54f1114))
* **web:** serve the C4 architecture map at /architecture.html ([c6ba6bc](https://github.com/cambopalmer/Stomp/commit/c6ba6bc03f936b33b57788f7801559c516cd5adc))


### Bug Fixes

* **architecture:** C4 diagrams were rendering blank; polish the notation ([8046c17](https://github.com/cambopalmer/Stomp/commit/8046c17d40a944de8cd721ebfc50ad57b3817173))
* **auth:** close the two MEDIUM security-review findings ([c26f616](https://github.com/cambopalmer/Stomp/commit/c26f6163b4993af112b3fc41e2959b5f727ef605))
* **deps:** drizzle-orm 0.36 → 0.45.2 (SQL-identifier injection advisory) ([2a103a3](https://github.com/cambopalmer/Stomp/commit/2a103a34a91d9b998c2126ae4127a7b8c41dbbc7))


### Documentation

* **architecture:** C4 model + interactive click-through map ([e17d93e](https://github.com/cambopalmer/Stomp/commit/e17d93e3fb07f4056666d525ab227443de0a1fe0))
* **architecture:** redraw the C4 map in conventional C4 notation ([c4bfd10](https://github.com/cambopalmer/Stomp/commit/c4bfd103a2703bc08f6232318fbe698678b9e0a8))
* backlog the deferred dependency-upgrade sweep ([f0b3ec5](https://github.com/cambopalmer/Stomp/commit/f0b3ec54f1a62f398b69bd772d1e2339a9e5e27e))
* Google OAuth setup walkthrough ([9693005](https://github.com/cambopalmer/Stomp/commit/96930055a408e0a9bbe0a7231a871bd2f10bb5a3))
* mark Phase 3 merged; note trunk-only branch policy ([6ca9422](https://github.com/cambopalmer/Stomp/commit/6ca9422cb86c07f75cf1dd96d060fe85cf6e0a8f))

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
