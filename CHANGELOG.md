# Changelog

All notable changes to STOMP. Format per [Keep a Changelog](https://keepachangelog.com/);
versioning per [SemVer](https://semver.org/). Pre-1.0: minor = feature milestone
(≈ a phase), patch = fixes within one. Releases from **v0.4.0** onward are cut by
[release-please](https://github.com/googleapis/release-please) from Conventional Commits.

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
