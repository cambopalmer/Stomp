# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** STOMP
**Generated:** 2026-08-31 15:30:26
**Category:** Productivity Tool
**Design Dials:** Variance 3/10 (Centered / Minimal) | Motion 3/10 (Subtle) | Density 7/10 (Standard)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#0D9488` | `--color-primary` |
| On Primary | `#000000` | `--color-on-primary` |
| Secondary | `#14B8A6` | `--color-secondary` |
| On Secondary | `#0F172A` | `--color-on-secondary` |
| Accent/CTA | `#EA580C` | `--color-accent` |
| On Accent/CTA | `#000000` | `--color-on-accent` |
| Background | `#F0FDFA` | `--color-background` |
| Foreground | `#134E4A` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#134E4A` | `--color-card-foreground` |
| Muted | `#E8F1F4` | `--color-muted` |
| Muted Foreground | `#475569` | `--color-muted-foreground` |
| Border | `#99F6E4` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#0D9488` | `--color-ring` |

**Color Notes:** Teal focus + action orange [Accent adjusted from #F97316]

### Typography

- **Heading Font:** Plus Jakarta Sans
- **Body Font:** Plus Jakarta Sans
- **Mood:** friendly, modern, saas, clean, approachable, professional
- **Google Fonts:** [Plus Jakarta Sans + Plus Jakarta Sans](https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

*Density: 7/10 — Standard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #EA580C;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #0D9488;
  border: 2px solid #0D9488;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #F0FDFA;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #0D9488;
  outline: none;
  box-shadow: 0 0 0 3px #0D948820;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Minimalism & Swiss Style

**Keywords:** Clean, simple, spacious, functional, white space, high contrast, geometric, sans-serif, grid-based, essential

**Best For:** Enterprise apps, dashboards, documentation sites, SaaS platforms, professional tools

**Key Effects:** Subtle hover (200-250ms), smooth transitions, sharp shadows if any, clear type hierarchy, fast loading

### Page Pattern

**Pattern Name:** Product Demo + Features

- **Conversion Strategy:** Use an interactive demo only when it explains value better than static media. Provide captions, transcript, visible play/pause controls, and a non-video fallback; do not autoplay under reduced motion. Pause media when offscreen or hidden and keep the final product state available as static content.
- **CTA Placement:** Video center + CTA right/bottom
- **Section Order:** Hero > Product video/mockup (center) > Feature breakdown per section > Comparison (optional) > CTA

---

## Motion

**Scroll Reveal** (Subtle) — Trigger: scroll (viewport enter) | Duration: 300-400ms | Easing: `power1.out`

```js
gsap.from(el, { opacity: 0, y: 12, duration: 0.35, ease: 'power1.out', scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' } });
```

**Framework notes:** Requires the ScrollTrigger plugin registered once via gsap.registerPlugin(ScrollTrigger); Use matchMedia('(prefers-reduced-motion: reduce)') to skip non-essential motion and render the final state immediately

- ✅ Keep the y offset small (8-16px) so it reads as a fade, not a slide
- ❌ Don't reveal below-the-fold content needed for SEO/crawlers as invisible-by-default without a no-JS fallback
- ⚡ toggleActions 'play none none reverse' avoids re-triggering on every scroll direction change

---

## Anti-Patterns (Do NOT Use)

- ❌ Complex onboarding
- ❌ Slow performance

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

---
---

# STOMP overrides & additions

> Everything above is the `ui-ux-pro-max` generator output (v2.15.0, 2026-08-31, dials V3/M3/D7). Regenerate with:
> `python .claude/skills/ui-ux-pro-max/scripts/search.py "internal productivity dashboard task calendar app" --design-system --variance 3 --motion 3 --density 7 -p "STOMP" --persist --output-dir "." --force`
> then re-apply the sections below. The generator does not produce these (it targets landing pages / light on dark-mode + a11y depth).

## O1. Page pattern — OVERRIDE

The generated "Product Demo + Features" pattern is a **marketing landing pattern and does not apply to the app.** STOMP's pattern is a **dashboard/hub shell**:

```
┌ banner (wordmark · date/greeting · Quick Add · Create account) ──────────┐
├ left nav (Home · Calendar · Todos · Incoming · Learn · Projects) ┬ content ┤
│                                                                 │  + hot   │
│  desktop: persistent sidebar    mobile: bottom nav ≤5           │  rail on │
│                                                                 │  Home    │
└─────────────────────────────────────────────────────────────────┴──────────┘
```

The landing pattern is reserved for a **future public marketing page only** (not in any current phase).

## O2. Color — dark mode pairs + card correction

The generator gives light only. Dark counterparts (verify contrast on implementation):

| Token | Light (generated) | Dark (derived) |
|---|---|---|
| `--color-background` | `#F0FDFA` | `#0B1220` |
| `--color-foreground` | `#134E4A` | `#E6EDF3` |
| `--color-card` | `#FFFFFF` | `#111A2B` |
| `--color-card-foreground` | `#134E4A` | `#E6EDF3` |
| `--color-muted` | `#E8F1F4` | `#1B2536` |
| `--color-muted-foreground` | `#475569` | `#93A1B4` |
| `--color-border` | `#99F6E4` → *use `#CBD5E1` for neutral separators* | `#243044` |
| `--color-primary` | `#0D9488` | `#2DD4BF` |
| `--color-accent` | `#EA580C` | `#FB923C` |
| `--color-destructive` | `#DC2626` | `#F87171` |

- **Card correction:** the generated `.card` uses `background:#F0FDFA` (same as page bg). Cards must use `--color-card` (`#FFFFFF` light) on `--color-background`. The `#99F6E4` border is a teal tint — fine for accent chips, but use a neutral `#CBD5E1` / dark `#243044` for structural borders so the UI doesn't read as "all teal".
- **Sanctioned alternates** if the owner reacts against teal (same structure, swap primary+accent): *Micro-SaaS* indigo `#6366F1` + emerald `#059669`; *sage-neutral* `#6B7280` + cyan `#0891B2` on `#F5F5F0`. Pick one before Phase 1 polish; Phase 0 uses the generated teal.
- **Priority scale** (always with icon/label, never color alone): none `--color-muted-foreground` · low `#0EA5E9` · medium `#F59E0B` · high `#F97316` · urgent `#DC2626`.
- **Status:** overdue = `--color-destructive`; due-today = `#2563EB`; done/confirmed = `#059669`.

## O3. Typography additions

- `font-variant-numeric: tabular-nums` on all counts, dates, times, durations, and list metadata (prevents row jitter).
- Type scale (px): 12 · 14 · 16 · 18 · 20 · 24 · 30. Body 16. Line-height 1.5 body / 1.25 headings.
- Reading measure 60–75ch desktop, 35–60ch mobile for notes/descriptions.
- Optional `"JetBrains Mono"` for dense numeric columns only.

## O4. Icons

**Lucide** (ships with shadcn/ui; generator lists Heroicons/Lucide as acceptable). 1.5px stroke. 16 inline / 20 lists & buttons / 24 nav. Decorative icons `aria-hidden`; standalone meaningful icons get an accessible name + state.

## O5. Motion scope

The generated GSAP Scroll-Reveal snippet is for **marketing/onboarding pages only**. In the app: micro-interactions only — 120–160ms `ease-out` hover/press (`transform`/`opacity`), 180–220ms dialogs animating from their trigger, exit ~65% of enter. Max 1–2 animated elements per view. Honor `prefers-reduced-motion` and never depend on an animation-end event for correctness.

## O6. Accessibility floor — WCAG 2.2 AA (fuller than the generated checklist)

- Text contrast ≥ 4.5:1; non-text / UI ≥ 3:1. Test light and dark independently.
- Full keyboard operation; visible focus ring (2px `--color-ring`, 2px offset, ≥ 3:1); `Skip to main content` link; focus moves to `<main>` on route change.
- Tab/reading order matches visual order. Sequential `h1→h6`.
- Color never the only signal — pair with icon / text / pattern.
- Sticky banner & overlays must not obscure the focused control.
- Reduced motion honored; layout survives 200% zoom / large text with no clipping.
- **Forms:** visible labels (never placeholder-only), required markers, persistent helper text, validate on blur, error text below the field linked via `aria-describedby`, a focusable error summary at the top on submit failure, `role="alert"` / `aria-live` for async errors, autosave drafts on long notes, confirm before dismissing a dialog with unsaved changes.
- **Toasts:** `aria-live="polite"`, never steal focus, auto-dismiss 3–5s, offer **Undo** for destructive/bulk actions.
- **Destructive actions:** `--color-destructive`, spatially separated from primary actions, always recoverable via Undo (hard-delete + `activity_log` per ADR-0003).

## O7. Per-surface rules

| Surface | Rules |
|---|---|
| Home tiles | Exactly one primary CTA (Quick Add, using `--color-accent`). Whole card is one ≥44px link, `cursor-pointer`, no layout-shift on hover (shadow/opacity only). Counts tabular. |
| Hot rail | Buckets = icon + text label + color. Sticky; must not cover focused content. Announce count changes politely without moving focus. Order: Overdue → Urgent → Due today → High → Incoming(unread) → Today's events. Empty buckets hidden; "All clear" state. |
| Todos list | Rows ≥44px; checkbox a real target with ≥8px spacing; group headers `h2`; inline quick-add validates on blur. Priority + status shown with icon+label. |
| Forms (todo/project/event/reference) | Full O6 form rules. Delete separated + Undo toast. |
| Calendar | Tabular time labels; today's column marked by more than color; grid scrolls inside its own `overflow-x:auto` container on mobile. |
| Navigation | Persistent left sidebar (desktop) / bottom nav ≤5 (mobile). Active item = color + weight + left indicator. Breadcrumbs for project → item depth. |
| Project progress (Phase 1) | Bar/progress only; visible legend + screen-reader text summary; not color-alone. |

## O8. Stack mapping

Tokens → `apps/web/src/index.css` as CSS variables on `:root` + `@media (prefers-color-scheme: dark)` + `:root[data-theme]`. Tailwind reads them via `theme.extend.colors` referencing the vars. shadcn/ui components themed by pointing its `--background`/`--foreground`/`--primary`/etc. at these tokens. No raw hex in components — token classes only.
