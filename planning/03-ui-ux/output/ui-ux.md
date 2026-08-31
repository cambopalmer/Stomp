# STOMP — UI / UX

**Design system:** [`design-system/stomp/MASTER.md`](../../../design-system/stomp/MASTER.md) — tokens, typography, spacing, motion, icons, and the WCAG 2.2 AA floor. Derived from the `ui-ux-pro-max` skill (see [ADR-0004](../../_config/decisions/adr-0004-design-tooling.md)). This document covers structure (routes, screens, layout, components); MASTER covers look, feel, and accessibility rules.

## 1. Route tree

```
/                        Home — banner, tiles, hot sidebar
/calendar                Calendar landing — today + week, event list
/calendar/:eventId       Event detail / edit
/todos                   Todos landing — lists, filters (status, priority, tag, project)
/todos/:todoId           Todo detail / edit (subtasks inline)
/incoming                Incoming landing — triage queue
/learn                   Learn landing — reference grid, filter by tag/status
/learn/:referenceId      Reference detail / edit
/projects                Projects list
/projects/:projectId     Project detail — mixed items (todos, events, refs, incoming) + members
/tags/:slug              Everything with a tag (cross-section)
/settings                Profile, timezone (auth + integrations UI later)
/signup                  Phase 0: static stub reached from the banner "Create account" link.
                         Phase 3: real signup / onboarding / invite acceptance.
/sitemap.xml             Generated (see architecture §5)

Later phases add:
/notifications           Phase 2 — notifications list (reminders, past-due, share invites)
/workspaces              Phase 2 — workspace list + member management
/workspaces/:id          Phase 2 — one workspace's settings + members
```

**Active workspace:** Phase 0 is fixed to "Personal" (`workspace_id = NULL`) — no switcher.
Phase 2 adds a workspace selector in the banner; the choice scopes every list and every
create form's default `workspace_id`. Routes above stay the same; data is filtered by the
active workspace client- and server-side.

Route patterns live in `apps/web/src/lib/routeManifest.ts`, which the sitemap builder and the router both read.

## 2. Screen inventory

| Screen | Purpose | Primary data |
|---|---|---|
| Home | "What needs me now?" + navigation | tile counts per section, hot sidebar payload |
| Calendar landing | today's schedule + week view + upcoming | `events` in range, visible to user |
| Event detail | view/edit one event, attendees | one `event` + `event_attendees` |
| Todos landing | work the list | `todos` (visible), grouped by Today / Overdue / Upcoming / No date; filters |
| Todo detail | edit, subtasks, assignment, project | one `todo` + children + `activity_log` |
| Incoming landing | triage to zero | `incoming_items` where `for_user_id = me, status = unread` |
| Learn landing | pick what to study | `references` (visible), filter tag/status |
| Reference detail | edit link, status, tags, open | one `reference` |
| Projects list | see all projects + progress | `projects` (member of) + counts |
| Project detail | run a project | all item types where `project_id = :id` + `project_members` |
| Tag page | cross-section view of a tag | `taggings` joined to each entity |
| Settings | profile + timezone | `users` row |

## 3. Home layout

```
┌──────────────────────────────────────────────────────────────┐
│  BANNER: STOMP  [greeting, date]  [+ quick add] [Create acct] │  ← quick add opens a
├───────────────────────────────────────────┬──────────────────┤    capture box → incoming
│                                           │                  │    "Create acct" → /signup
│                                           │                  │    (stub in Phase 0)
│  TILE GRID (2×2 on desktop, stack mobile) │  HOT & RELEVANT   │
│  ┌───────────┐ ┌───────────┐              │  ┌─────────────┐  │
│  │ CALENDAR  │ │  TODOS    │              │  │ ⚠ Overdue   │  │
│  │ 3 today   │ │ 5 open    │              │  │  · Item A   │  │
│  │ · 09:00…  │ │ · 2 today │              │  │ 🔴 Urgent   │  │
│  │ · 14:00…  │ │ · 1 over  │              │  │  · Item B   │  │
│  └───────────┘ └───────────┘              │  │ 📅 Due today│  │
│  ┌───────────┐ ┌───────────┐              │  │  · Item C   │  │
│  │ INCOMING  │ │  LEARN    │              │  │ 📥 Incoming │  │
│  │ 4 to sort │ │ 12 saved  │              │  │  · 4 unread │  │
│  │ · latest… │ │ · 3 learn │              │  └─────────────┘  │
│  └───────────┘ └───────────┘              │                  │
│  ┌──────────────────────────┐             │  Sidebar is       │
│  │ PROJECTS (wide tile)     │             │  sticky; on       │
│  │ · STOMP Buildout  8/20   │             │  mobile it moves  │
│  └──────────────────────────┘             │  below the tiles. │
└───────────────────────────────────────────┴──────────────────┘
```

- Each tile: icon, section name, headline count, up to 3 relevant lines, whole card links to the landing page.
- Banner "+" quick add: single text field → creates an `incoming_item` (`kind = 'capture'`). Keyboard shortcut `c`.
- Hot sidebar buckets in order: **Overdue → Urgent → Due today → High priority → Incoming (unread) → Today's events**. Empty buckets hidden. "All clear" state when everything's empty.

## 4. Per-section landing pages

**Calendar** — date-strip header (prev/today/next), Today column (hour grid), "Later this week" list, "+ event". Read-only external events (later) visually marked.

**Todos** — segmented groups: `Overdue`, `Today` (`scheduled_for` or `due_at` today), `Upcoming`, `Someday` (no date), `Done` (collapsed). Filter bar: status, priority, project, tag, assignee. Inline complete checkbox, inline quick-add per group.

**Incoming** — one card per unread item showing source (capture / shared by X / email). Per card actions: **→ Todo**, **→ Event**, **Dismiss**. "→ Todo" opens a prefilled todo form; on save the incoming item becomes `triaged` with `linked_entity_*` set.

**Learn** — responsive card grid. Each card: title, domain, status pill, tags. Filters: status, tag, favorites. "+ reference" (paste URL → optional title autofill later).

**Project detail** — header (name, description, members, progress bar = done/total todos). Tabs or sections: Todos | Events | References | Incoming. "Add existing" or "create in project". Members list (add-member UI is Phase 3; data model ready).

## 5. Sitemap strategy for dynamic items

- `GET /sitemap.xml` enumerates static routes from `routeManifest.ts` + one `<url>` per row in `projects`, `todos`, `events`, `references`, and per distinct tag.
- `lastmod` = entity `updated_at`.
- In-memory cache, 5 min TTL, busted by a global write counter incremented on every mutation.
- `robots.txt` static, references the sitemap. (For a private hub, `Disallow: /` is likely correct — confirm in Stage 06 whether any of this is ever public.)

## 6. Component inventory (build)

| Component | Notes |
|---|---|
| `AppShell` | banner + content slot + sidebar slot |
| `Banner` | logo, greeting, quick-add trigger |
| `QuickAddDialog` | shadcn `Dialog` + `Input` → POST incoming |
| `SectionTile` | icon, count, lines, link |
| `HotSidebar` | fetches `/api/home/hot`, renders buckets |
| `TodoList` / `TodoRow` / `TodoForm` | list, row w/ checkbox, create/edit form (RHF + Zod) |
| `EventList` / `EventForm` / `DayGrid` | |
| `ReferenceCard` / `ReferenceForm` | |
| `IncomingCard` | source badge + triage actions |
| `ProjectCard` / `ProjectDetail` | |
| `TagPill` / `PriorityBadge` / `StatusPill` | |
| `EmptyState` | reused everywhere |
| `WorkspaceSwitcher` | Phase 2 — banner dropdown; Phase 0 renders a static "Personal" label |
| `NotificationsBell` / `NotificationsPanel` | Phase 2 |
| shadcn/ui primitives | button, input, dialog, select, popover, tabs, card, badge, dropdown-menu, toast |

## 7. Visual direction

Generated by the `ui-ux-pro-max` skill — see [`design-system/stomp/MASTER.md`](../../../design-system/stomp/MASTER.md). In brief:
- **Style:** Minimalism & Swiss (clean, grid-based, spacious, high contrast).
- **Type:** Plus Jakarta Sans (headings + body), + tabular numerals for counts/dates/times.
- **Color:** teal `#0D9488` primary, orange `#EA580C` accent, near-white bg; semantic tokens, light + dark (dark pairs added in MASTER O2). Two alternate palettes sanctioned if teal is rejected (open question D5).
- **Spacing:** 4/8 scale, density 7/10 (dashboard-leaning). **Icons:** Lucide. **Motion:** subtle micro-interactions only.
- **Pattern:** dashboard/hub shell (MASTER O1) — the generator's "Product Demo" landing pattern is overridden; it's reserved for a future marketing page.
- **A11y:** WCAG 2.2 AA (MASTER O6). Priority/status never by color alone.

## 8. Skill rule categories applied (from `ui-ux-pro-max`)

Phase 0/1 build must satisfy, per surface (full detail in MASTER §10–11):

| Category | Where it bites in STOMP |
|---|---|
| 1 Accessibility | focus rings on every control; skip-link; `h1→h6` order; color-not-only for priority/status; contrast AA |
| 2 Touch & interaction | tile cards & todo rows ≥44px; 8px between checkboxes; `cursor-pointer`; loading state on every async button |
| 4 Style selection | one style everywhere; Lucide only, no emoji; project colors as dots/borders, contrast-checked |
| 5 Layout & responsive | mobile-first 375/768/1024/1440; no body horizontal scroll; calendar grid scrolls in its own container; `min-h-dvh` |
| 6 Typography & color | base 16px; tabular numerals for counts/dates/times; semantic tokens, no raw hex |
| 7 Animation | 120–160ms hover/press; dialogs animate from trigger; `prefers-reduced-motion` |
| 8 Forms & feedback | visible labels; validate on blur; error below field + `aria-describedby`; error summary + focus on submit fail; Undo toast on delete; autosave long notes |
| 9 Navigation | persistent left nav / mobile bottom nav ≤5; active state = color+weight+indicator; breadcrumbs for project→item |
| 10 Charts & data | (Phase 1 project progress) legend + text summary, not color-alone |
