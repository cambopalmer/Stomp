# ADR-0004: Design tooling — ui-ux-pro-max skill

**Status:** Accepted (2026-08-31). Both follow-ups resolved same day.
**Context:** Owner wants the "UI UX Pro Max" skill driving UI/UX planning. Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

## Decision

- Installed globally: `npm i -g ui-ux-pro-max-cli` (`uipro` v2.15.0).
- Installed into this project: `uipro init --ai claude` → wrote skills to `.claude/skills/`.
- STOMP's design system lives at `design-system/stomp/MASTER.md` (the skill's persistence convention), page overrides in `design-system/stomp/pages/`.
- Stage 03 (UI/UX) is authored against the skill's Quick Reference rule categories (1–10) and its design-system structure.

## Follow-ups — resolved

1. **Bundle pruned (D3).** `uipro init` installed 7 skills. Kept **`ui-ux-pro-max`** + **`ui-styling`** (shadcn/Tailwind guidance, genuinely useful). Removed `design` (it shadowed Claude Code's built-in `design` canvas skill), `banner-design`, `brand`, `design-system`, `slides`. Revisit if one becomes relevant.
2. **Python 3 installed (D4).** Python 3.12.10 at `C:\Users\Dani\AppData\Local\Programs\Python\Python312\`. Note: pre-existing shells may have a stale PATH and hit the Microsoft Store `python.exe` alias — call the generator with the full interpreter path if `python` resolves to WindowsApps. `MASTER.md` regenerated via `search.py --design-system --persist` (dials V3/M3/D7) and reconciled — the generated content is the spine; the `# STOMP overrides & additions` section adds the app shell pattern, dark-mode tokens, fuller WCAG 2.2 AA rules, and per-surface notes the generator doesn't produce.

## Generated design system — key outputs

- **Style:** Minimalism & Swiss Style (clean, grid-based, spacious; best for dashboards/SaaS).
- **Type:** Plus Jakarta Sans (heading + body).
- **Color:** "Productivity Tool" palette — teal `#0D9488` primary, orange `#EA580C` accent, on a near-white teal-tinted bg. Two sanctioned alternates recorded in MASTER O2 if the owner wants a different brand color (decide before Phase 1 polish).
- **Icons:** Lucide (generator accepts Heroicons/Lucide; Lucide chosen for shadcn/ui consistency).

## Notes

- **Skills activate on Claude Code restart** — not invocable via the Skill tool mid-session; content applied manually until then.
- `.claude/skills/**` is committed (shared tooling). `__pycache__/` ignored.

## Files touched

- `.claude/skills/{ui-ux-pro-max,ui-styling}/**` (kept); 5 other skill folders removed
- `design-system/stomp/MASTER.md`, `design-system/stomp/pages/README.md`
- `.gitignore` — `__pycache__/`, `*.pyc`
