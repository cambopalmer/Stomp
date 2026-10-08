import type { CategoryColor } from "@stomp/shared";

/** Day planner helpers (ADR-0006) — pure, unit-tested. Times are wall-clock minutes since local midnight. */

export const SLOT_MIN = 15;
export const DAY_MIN = 1440;
/** 24 px per 15 min: a slot meets WCAG 2.2's 24 px minimum target (2.5.8). */
export const SLOT_PX = 24;
export const MIN_PX = SLOT_PX / SLOT_MIN;

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const hourFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", timeZone: "UTC" });

/** 570 → "9:30 AM" (locale-aware). 1440 → "12:00 AM". */
export const fmtMin = (m: number) => timeFmt.format(Date.UTC(2000, 0, 1, 0, m));
export const fmtHourLabel = (h: number) => hourFmt.format(Date.UTC(2000, 0, 1, h));
export const fmtRange = (a: number, b: number) => `${fmtMin(a)} – ${fmtMin(b)}`;

export const fmtDuration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
};

/** Snap down to the 15-minute grid and clamp to the day. */
export const snap = (m: number) => Math.min(DAY_MIN - SLOT_MIN, Math.max(0, Math.floor(m / SLOT_MIN) * SLOT_MIN));

/** Local YYYY-MM-DD for a Date (wall-clock — never via toISOString, which is UTC). */
export const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDaysIso = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return isoLocal(new Date(y, m - 1, d + n));
};

export const fmtDayTitle = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(y, m - 1, d));
};

export interface Span {
  id: string;
  startMin: number;
  endMin: number;
}
export interface Placed {
  id: string;
  col: number;
  cols: number;
}

/**
 * Side-by-side columns for overlapping spans (ADR-0006: overlaps are allowed,
 * just laid out so nothing hides). Greedy per overlap cluster.
 */
export function layoutSpans(spans: Span[]): Map<string, Placed> {
  const sorted = [...spans].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out = new Map<string, Placed>();
  let cluster: Span[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const colEnds: number[] = [];
    const placed = cluster.map((s) => {
      let col = colEnds.findIndex((end) => end <= s.startMin);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(0);
      }
      colEnds[col] = s.endMin;
      return { s, col };
    });
    for (const { s, col } of placed) out.set(s.id, { id: s.id, col, cols: colEnds.length });
    cluster = [];
    clusterEnd = -1;
  };

  for (const s of sorted) {
    if (cluster.length && s.startMin >= clusterEnd) flush();
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, s.endMin);
  }
  if (cluster.length) flush();
  return out;
}

/**
 * Category palette: the colour carries the border, icon and a light tint; text
 * always uses the foreground token, so contrast never depends on the hue.
 */
export const PALETTE: Record<CategoryColor, string> = {
  blue: "#2563eb",
  violet: "#7c3aed",
  amber: "#d97706",
  orange: "#ea580c",
  rose: "#e11d48",
  teal: "#0d9488",
  green: "#16a34a",
  sky: "#0284c7",
  slate: "#64748b",
  fuchsia: "#c026d3",
};
export const UNCATEGORIZED_HEX = "#94a3b8";

/** "#2563eb" + alpha → rgba() for tinted backgrounds that work on light and dark. */
export const tint = (hex: string, alpha: number) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

// ─────────────────────────────────────── direct manipulation + review (slice 4)

/**
 * Where a drag lands, snapped to the grid and kept inside the day.
 * move: keeps the duration; resize: drags the end, at least one slot long.
 */
export function dragTo(
  mode: "move" | "resize",
  block: { startMin: number; endMin: number },
  deltaMin: number,
): { startMin: number; endMin: number } {
  const step = Math.round(deltaMin / SLOT_MIN) * SLOT_MIN;
  const duration = block.endMin - block.startMin;
  if (mode === "move") {
    const startMin = Math.min(Math.max(0, block.startMin + step), DAY_MIN - duration);
    return { startMin, endMin: startMin + duration };
  }
  return { startMin: block.startMin, endMin: Math.min(DAY_MIN, Math.max(block.startMin + SLOT_MIN, block.endMin + step)) };
}

/** A drag-to-create range on empty time: from where you pressed to where you let go, either direction. */
export function rangeFrom(aMin: number, bMin: number): { startMin: number; endMin: number } {
  const lo = snap(Math.min(aMin, bMin));
  const hi = Math.min(DAY_MIN, Math.max(lo + SLOT_MIN, Math.ceil(Math.max(aMin, bMin) / SLOT_MIN) * SLOT_MIN));
  return { startMin: lo, endMin: hi };
}

export interface CategoryTotal {
  categoryId: string | null;
  minutes: number;
}

/** Minutes per category for the day, largest first; skipped blocks don't count. */
export function categoryTotals(blocks: { categoryId: string | null; startMin: number; endMin: number; status: string }[]): CategoryTotal[] {
  const by = new Map<string | null, number>();
  for (const b of blocks) {
    if (b.status === "skipped") continue;
    by.set(b.categoryId, (by.get(b.categoryId) ?? 0) + (b.endMin - b.startMin));
  }
  return [...by.entries()].map(([categoryId, minutes]) => ({ categoryId, minutes })).sort((a, b) => b.minutes - a.minutes);
}

/** Planned vs actual: the original time when the block moved after it started, else null. */
export function plannedIfMoved(b: {
  startMin: number;
  endMin: number;
  plannedStartMin: number | null;
  plannedEndMin: number | null;
}): { startMin: number; endMin: number } | null {
  if (b.plannedStartMin == null || b.plannedEndMin == null) return null;
  if (b.plannedStartMin === b.startMin && b.plannedEndMin === b.endMin) return null;
  return { startMin: b.plannedStartMin, endMin: b.plannedEndMin };
}

// ─────────────────────────────────────── Home "Now / Next" (slice 6)

export interface NowNextItem {
  title: string;
  startMin: number;
  endMin: number;
  kind: "block" | "event";
}

/** What's on now and what's next today — blocks and timed events; skipped blocks don't count. */
export function nowNext(
  blocks: { title: string | null; todo?: { title: string } | null; startMin: number; endMin: number; status: string }[],
  events: { title: string; startMin: number; endMin: number; allDay: boolean }[],
  nowMin: number,
): { now: NowNextItem | null; next: NowNextItem | null } {
  const items: NowNextItem[] = [
    ...blocks
      .filter((b) => b.status !== "skipped")
      .map((b) => ({ title: b.title ?? b.todo?.title ?? "Block", startMin: b.startMin, endMin: b.endMin, kind: "block" as const })),
    ...events.filter((e) => !e.allDay).map((e) => ({ title: e.title, startMin: e.startMin, endMin: e.endMin, kind: "event" as const })),
  ].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  return {
    now: items.find((i) => i.startMin <= nowMin && nowMin < i.endMin) ?? null,
    next: items.find((i) => i.startMin > nowMin) ?? null,
  };
}
