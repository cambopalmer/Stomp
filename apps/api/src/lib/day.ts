/**
 * "Today" boundaries in a given IANA timezone, returned as UTC epoch-ms.
 * Uses Intl to find the tz offset at `nowMs`; good enough for day-bucket math.
 */
export function dayBounds(
  nowMs: number,
  timeZone: string,
): { dayStart: number; dayEnd: number; floatingDay: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA formats as YYYY-MM-DD
  const [y, m, d] = fmt.format(new Date(nowMs)).split("-").map(Number) as [number, number, number];

  // Midnight of that local date, expressed in UTC: start from the UTC guess then
  // correct by the zone's offset at that instant.
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const offset = tzOffsetMs(utcGuess, timeZone);
  const dayStart = utcGuess - offset;
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  // all-day events are floating dates at UTC midnight (ADR-0005): today, as one of those
  return { dayStart, dayEnd, floatingDay: utcGuess };
}

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const map: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = Number(p.value);
  const asUtc = Date.UTC(
    map.year!,
    map.month! - 1,
    map.day!,
    map.hour!,
    map.minute!,
    map.second!,
  );
  return asUtc - utcMs;
}

// ─────────────────────────────────────── wall-clock dates (planner, ADR-0006)

export type DayBounds = { dayStart: number; dayEnd: number; floatingDay: number };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Local midnight of `date` in `timeZone`, as UTC ms (offset re-checked so DST days come out right). */
function localMidnight(date: string, timeZone: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  let start = guess - tzOffsetMs(guess, timeZone);
  start = guess - tzOffsetMs(start, timeZone); // second pass: offset at the real instant
  return start;
}

export const addDaysIso = (date: string, n: number): string => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** UTC bounds of a named local date — 23 or 25 hours long on DST change days. */
export function dateBounds(date: string, timeZone: string): DayBounds {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return {
    dayStart: localMidnight(date, timeZone),
    dayEnd: localMidnight(addDaysIso(date, 1), timeZone),
    floatingDay: Date.UTC(y, m - 1, d),
  };
}

/** Today's local date and minute-of-day in `timeZone`. */
export function localNow(nowMs: number, timeZone: string): { date: string; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(nowMs));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** A usable IANA zone name (what Intl accepts). */
export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
