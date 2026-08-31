# Page-specific design overrides

One file per page that needs to deviate from `../MASTER.md`. A page file **overrides** Master for that page only; absent a file, Master applies verbatim.

Naming: `design-system/stomp/pages/<page-slug>.md` (e.g. `calendar.md`, `todos.md`, `project-detail.md`).

None exist yet — the whole app follows Master. Add one only when a screen genuinely needs different density, motion, or layout rules (e.g. a future calendar month-grid wanting denser spacing).

Generate via the skill once Python 3 is installed:
`python .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "STOMP" --page "<slug>" --output-dir "."`
