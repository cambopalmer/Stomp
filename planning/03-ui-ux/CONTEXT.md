# Stage 03: UI / UX

## Inputs
- `../00-prd/output/prd.md`
- `../02-data-model/output/schema.md`
- `../01-architecture/output/architecture.md` (sitemap strategy, route manifest)
- **`design-system/stomp/MASTER.md`** — the design system (tokens, type, spacing, motion, a11y floor)
- **`ui-ux-pro-max` skill** — Quick Reference rule categories 1–10 (`.claude/skills/ui-ux-pro-max/SKILL.md`); when Python 3 is available, run its `--design-system` generator and reconcile MASTER.md
- `../_config/decisions/adr-0004-design-tooling.md`

## Process
1. Define the information architecture / route tree.
2. Screen inventory: every page, its purpose, its data.
3. Home layout: banner, tile grid, hot sidebar.
4. Per-section landing page contents.
5. Wireframe notes (text) for home + one section.
6. Sitemap generation strategy for dynamic items.
7. Component inventory for the build.
8. Apply the design system + skill rule categories to each surface; record per-page overrides in `design-system/stomp/pages/` only where a screen truly deviates.

## Outputs
- `output/ui-ux.md`
- `design-system/stomp/MASTER.md` (+ any `pages/*.md`)

## Review gate
User confirms the route tree, home layout, and the design direction in MASTER.md before front-end scaffolding. Regenerate MASTER.md via the skill CLI once Python 3 is installed and reconcile before Phase 1 polish.
