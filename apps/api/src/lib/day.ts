/**
 * "Today" boundaries in a given IANA timezone, returned as UTC epoch-ms.
 * Uses Intl to find the tz offset at `nowMs`; good enough for day-bucket math.
 */
export function dayBounds(nowMs: number, timeZone: string): { dayStart: number; dayEnd: number } {
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
  return { dayStart, dayEnd };
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
