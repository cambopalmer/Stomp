import type { CalendarEvent, Todo } from "@stomp/shared";

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

/* ── todo helpers ───────────────────────────────────────────── */

/** What the calendar shows: events, todos, or both. `?show=` in the URL. */
export type CalendarShow = "all" | "events" | "todos";

export const parseShow = (s: string | null): CalendarShow =>
  s === "events" || s === "todos" ? s : "all";

/** A todo belongs on the calendar when it has a due date and is still open. */
export const isCalendarTodo = (t: Todo): t is Todo & { dueAt: number } =>
  t.dueAt != null && t.status !== "done" && t.status !== "cancelled";

/** Due before today (by local day), and still open. */
export const isOverdue = (t: Todo, now: number = Date.now()): boolean =>
  isCalendarTodo(t) && t.dueAt < startOfDay(now).getTime();

const PRIORITY_RANK: Record<Todo["priority"], number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

/** Open todos due on `day` (all-day items), priority-then-title sorted. */
export function todosOnDay(todos: Todo[], day: Date): Todo[] {
  const from = startOfDay(day).getTime();
  const to = from + DAY_MS;
  return todos
    .filter((t) => isCalendarTodo(t) && t.dueAt >= from && t.dueAt < to)
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title));
}

export interface DayGroup {
  day: number; // start-of-day epoch ms
  events: CalendarEvent[];
  todos: Todo[];
}

/**
 * Group events (by start day) and open todos (by due day) for the list view.
 * Chronological, days-with-something only; within a day todos come first, like all-day items.
 */
export function groupByDay(events: CalendarEvent[], todos: Todo[] = []): DayGroup[] {
  const map = new Map<number, DayGroup>();
  const bucket = (ms: number) => {
    const day = startOfDay(ms).getTime();
    let g = map.get(day);
    if (!g) map.set(day, (g = { day, events: [], todos: [] }));
    return g;
  };
  for (const e of [...events].sort((a, b) => a.startsAt - b.startsAt)) bucket(e.startsAt).events.push(e);
  for (const t of todos) if (isCalendarTodo(t)) bucket(t.dueAt).todos.push(t);
  const groups = [...map.values()].sort((a, b) => a.day - b.day);
  for (const g of groups) g.todos = todosOnDay(g.todos, new Date(g.day));
  return groups;
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
