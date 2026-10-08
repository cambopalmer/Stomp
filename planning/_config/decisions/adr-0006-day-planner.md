# ADR-0006: Day planner (Phase 4.5)

**Status:** Accepted (2026-10-07) — from a design session with the owner
**Context:** Todos say *what* and events say *when, with others*; neither gives a flexible, scannable plan for **my day**. The planner is "just get a plan for my day": a 15-minute grid of loose time blocks around the concrete events, kept so past days can be reviewed. It's expected to be used mostly on a phone. See the roadmap's Phase 4.5 for the original problem statement.

## Decision

### Model
- **`time_blocks` is its own lightweight entity** (the Sunsama / Akiflow shape), optionally **linked to a todo**. A block is *when + what kind*; a todo is *what must get done*. One todo may have several blocks.
  - Costs accepted: two objects when a todo is timeboxed, and a rule for "done" (below).
- **Fields:** `title` (optional when linked — the todo's title shows), `category_id`, `notes`, `todo_id?`, `anchor_event_id?` + `anchor_offset_min`, `status` (`planned | done | skipped`), `date`, `start_min`, `end_min`, `planned_start_min?` / `planned_end_min?` (snapshot), `workspace_id` (reserved, null in v1).
- **No per-block colour** — colour comes only from the category, to keep the day scannable.
- **Done:** ticking a linked block asks "also complete the todo?" (default *yes* when it's the todo's only block). Completing a todo elsewhere shows its blocks struck through; they aren't changed.
- **Every block has a time.** "Today, no time yet" is a todo with `scheduled_for` (Plan for) — the planner's tray shows those; there are no time-less blocks.
- **Overlaps are allowed** (with each other and with events), laid out side by side with a subtle marker. The planner never fights the user.
- **Personal only** in v1 (`workspace_id` reserved for household sharing later).

### Time
- **Wall-clock ("floating") time**: `date` (YYYY-MM-DD) + `start_min` / `end_min` in 0–1440, multiples of 15, `end_min ≤ 1440` (no midnight crossing). Rule of thumb adopted: *instants for things shared with others (events), wall-clock for personal intentions (blocks)* — same as iCalendar floating time; avoids DST / timezone-change shifts and makes "which day" explicit.
- Comparing with events (overlay, anchors) converts using the user's timezone at that moment.
- **The web app saves the browser's timezone to `users.timezone`** automatically (also fixes Google sign-ups defaulting to `UTC`).

### Events on the planner
- **Every event visible to the user** (own, imported Google mirrors, household events shared via workspace/project) is drawn as a **fixed, read-only block** — read from `events`, never copied, so the calendar and the plan can't drift. The planner **ignores the active-workspace switcher**: it's your day across every context.

### Categories
- **Per user**, each with name, colour (curated palette) and icon — meaning never by colour alone.
- **Defaults:** Work · Focus · Admin & errands · Chores · Family · Personal · Health · Travel, plus Uncategorized. Seeded on first use.
- **Hub defaults are admin-editable** (`/admin`): **additions reach every user**; renames and removals never touch existing users' categories. Used categories are archived, never deleted.

### Planned vs actual
- **Light, automatic:** a block's planned time is captured once, **when its start time arrives** (implemented lazily: the first read or write of a block whose start has passed records `planned_*` before applying any change). No "start my day" step. Review shows planned vs actual + status.
- **No roll-over.** Unfinished blocks stay unfinished on their day — no auto-carry, no copy-to-tomorrow; the todo list carries unfinished work.
- **Past days stay editable**; their snapshot doesn't.

### Smart planning
- **v1 — anchored blocks:** a block can anchor to an event with an offset (e.g. ends when the event starts). On an event, **"Add before…"** stacks blocks before it (first defaults to *Travel*). Anchored blocks **follow the event** when it moves, including to another day. If the event is **cancelled / deleted / dropped by sync**, anchored blocks are **kept, un-anchored and flagged** (one-tap remove) — a sync blip must not silently delete the plan.
- **Next — prep templates:** remember "before *Gymnastics*: Drive 30, Dinner 30" and suggest it when a matching event appears (by title / recurring series).
- **Later — real travel time** (maps API: key, cost, home address) and **"leave by" reminders** (needs notifications, open question C6).

### UX (mobile-first)
- One vertical timeline per day, **24 px per 15 min** (amended in build from ~16 px: a 15-min slot must meet WCAG 2.2 SC 2.5.8's 24 px minimum target), opens at **now** with a now-line.
- **Tap a slot → bottom sheet**: title, category chips, start, duration presets (15/30/45/60/90/custom).
- **Move / resize:** long-press drag snapping to 15 min **and** −15 / +15 controls in the sheet (WCAG 2.2 SC 2.5.7 dragging alternative; thumb-friendly). Targets ≥ 44 px.
- **Tray:** a bottom drawer with today's todos (Plan for today, due today, overdue) → "Schedule at…".
- Desktop: same view, mouse drag-to-create, tray alongside; keyboard: arrows move the selected block 15 min, Shift+arrows resize.
- **Installable PWA** (manifest + icons, "Add to Home Screen"); **no offline** in v1.

### v1 scope
- **In:** the above + day notes, day totals by category, **copy a previous day's plan to today** (as a routine: blocks stamped as *planned*; links to completed todos dropped; anchors not copied), Home "Now / Next" tile, **Plan** nav item, admin default-category editor.
- **Later:** weekly totals, named templates, prep templates, reminders, sharing, travel-time lookup, offline.

## Consequences
- New tables: `categories`, `default_categories`, `time_blocks`, `day_notes`. `users.timezone` becomes actively maintained.
- Event changes (edit, move, cancel, Google sync removals) must notify anchored blocks — sync and events services gain a hook.
- The planner needs a client-side "today" in the user's timezone; server endpoints take an explicit `date`.
