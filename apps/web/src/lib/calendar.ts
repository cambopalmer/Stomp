import type { CalendarEvent } from "@stomp/shared";

export const DAY_MS = 86_400_000;
export const WEEK_STARTS_ON = 0; // 0 = Sunday

/* ── date math (all local-time) ──────────────────────────────── */

export const startOfDay = (d: Date | number): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d: Date | number, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const addMonths = (d: Date | number, n: number): Date => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n, 1);
  return x;
};

export const startOfWeek = (d: Date | number): Date => {
  const x = startOfDay(d);
  const diff = (x.getDay() - WEEK_STARTS_ON + 7) % 7;
  return addDays(x, -diff);
};

export const startOfMonth = (d: Date | number): Date => {
  const x = new Date(d);
  x.setDate(1);
  return startOfDay(x);
};

export const sameDay = (a: Date | number, b: Date | number): boolean => {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
};

export const isToday = (d: Date | number): boolean => sameDay(d, Date.now());

/* ── grids ──────────────────────────────────────────────────── */

/** 6 weeks (42 days) covering the month that `anchor` falls in. */
export function monthGridDays(anchor: Date): Date[] {
  const first = startOfWeek(startOfMonth(anchor));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

/** The 7 days of the week `anchor` falls in. */
export function weekDays(anchor: Date): Date[] {
  const first = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/* ── event helpers ──────────────────────────────────────────── */

/** Events that touch `day` (start, end, or span across it), start-time sorted. */
export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const from = startOfDay(day).getTime();
  const to = from + DAY_MS;
  return events
    .filter((e) => e.startsAt < to && e.endsAt > from)
    .sort((a, b) => a.startsAt - b.startsAt || a.endsAt - b.endsAt);
}

export interface DayGroup {
  day: number; // start-of-day epoch ms
  events: CalendarEvent[];
}

/** Group events by their start day, chronological, days-with-events only. */
export function groupByDay(events: CalendarEvent[]): DayGroup[] {
  const map = new Map<number, CalendarEvent[]>();
  for (const e of [...events].sort((a, b) => a.startsAt - b.startsAt)) {
    const key = startOfDay(e.startsAt).getTime();
    const bucket = map.get(key);
    if (bucket) bucket.push(e);
    else map.set(key, [e]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, dayEvents]) => ({ day, events: dayEvents }));
}

/* ── week time-grid layout ──────────────────────────────────── */

export interface PositionedEvent {
  event: CalendarEvent;
  /** fraction of the day [0,1) */
  top: number;
  /** fraction of the day (min ~0.02 so short events stay tappable) */
  height: number;
  /** column index and total columns among mutually-overlapping events */
  col: number;
  cols: number;
}

/**
 * Lay a single day's timed events into side-by-side columns so overlapping
 * events don't cover each other. Clamps to the day's own 00:00–24:00 bounds.
 */
export function layoutDay(events: CalendarEvent[], day: Date): PositionedEvent[] {
  const dayStart = startOfDay(day).getTime();
  const timed = events
    .filter((e) => !e.allDay)
    .map((e) => {
      const s = Math.max(e.startsAt, dayStart);
      const en = Math.min(e.endsAt, dayStart + DAY_MS);
      return { event: e, s, en };
    })
    .sort((a, b) => a.s - b.s || a.en - b.en);

  const out: PositionedEvent[] = [];
  // process in overlap-clusters
  let cluster: typeof timed = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = []; // running end time per column
    const placed = cluster.map((item) => {
      let col = colEnds.findIndex((end) => end <= item.s);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(0);
      }
      colEnds[col] = item.en;
      return { item, col };
    });
    const cols = colEnds.length;
    for (const { item, col } of placed) {
      const top = (item.s - dayStart) / DAY_MS;
      out.push({
        event: item.event,
        top,
        height: Math.max((item.en - item.s) / DAY_MS, 0.018),
        col,
        cols,
      });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of timed) {
    if (cluster.length && item.s >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.en);
  }
  flush();
  return out;
}
