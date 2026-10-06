import type { GoogleCalendarChoice } from "@stomp/shared";
import { googleGet } from "../lib/google.js";

/**
 * Google Calendar adapter — read-only (ADR-0005). Pure translation between
 * Google's REST shapes and STOMP's; persistence lives in services/sync.ts.
 */

const API = "https://www.googleapis.com/calendar/v3";

/** How far back / ahead each sync looks. Everything outside is left alone. */
export const WINDOW_PAST_DAYS = 30;
export const WINDOW_FUTURE_DAYS = 180;

interface GCalendarListEntry {
  id: string;
  summary?: string;
  summaryOverride?: string;
  primary?: boolean;
  backgroundColor?: string;
  deleted?: boolean;
  hidden?: boolean;
}

export async function listCalendars(accessToken: string): Promise<Omit<GoogleCalendarChoice, "selected">[]> {
  const out: Omit<GoogleCalendarChoice, "selected">[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({ maxResults: "250", ...(pageToken ? { pageToken } : {}) });
    const page = await googleGet<{ items?: GCalendarListEntry[]; nextPageToken?: string }>(
      `${API}/users/me/calendarList?${q}`,
      accessToken,
    );
    for (const c of page.items ?? []) {
      if (c.deleted) continue;
      out.push({
        id: c.id,
        summary: c.summaryOverride ?? c.summary ?? c.id,
        primary: !!c.primary,
        color: c.backgroundColor ?? null,
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  // primary first, then alphabetical
  return out.sort((a, b) => Number(b.primary) - Number(a.primary) || a.summary.localeCompare(b.summary));
}

interface GEventTime {
  date?: string; // all-day: "2026-10-06"
  dateTime?: string; // timed: RFC 3339
  timeZone?: string;
}
interface GEvent {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  start?: GEventTime;
  end?: GEventTime;
  etag?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
}

/** What a synced Google event becomes in STOMP. */
export interface MirroredEvent {
  /** `<calendarId>|<eventId>` — the same event can live in two of your calendars */
  externalId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: number;
  endsAt: number;
  allDay: boolean;
  timezone: string;
  status: "confirmed" | "tentative";
  etag: string | null;
}

/**
 * All-day events are floating dates (ADR-0005): Google's `date` "2026-10-06"
 * becomes UTC midnight of that date; `end.date` is already exclusive.
 */
const utcMidnight = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};

export function toMirror(calendarId: string, e: GEvent, calendarTz: string): MirroredEvent | null {
  if (e.status === "cancelled" || !e.start || !e.end) return null;
  // you said no — don't put it on your calendar
  if (e.attendees?.some((a) => a.self && a.responseStatus === "declined")) return null;

  const allDay = !!e.start.date;
  const startsAt = allDay ? utcMidnight(e.start.date!) : Date.parse(e.start.dateTime!);
  const endsAt = allDay ? utcMidnight(e.end.date!) : Date.parse(e.end.dateTime!);
  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return null;

  return {
    externalId: `${calendarId}|${e.id}`,
    title: e.summary?.trim() || "(No title)",
    description: e.description ?? null,
    location: e.location ?? null,
    startsAt,
    endsAt: Math.max(endsAt, startsAt),
    allDay,
    timezone: e.start.timeZone ?? calendarTz,
    status: e.status === "tentative" ? "tentative" : "confirmed",
    etag: e.etag ?? null,
  };
}

/** Every event instance in [timeMin, timeMax) — recurring events expanded (singleEvents). */
export async function listWindow(
  accessToken: string,
  calendarId: string,
  timeMin: number,
  timeMax: number,
): Promise<MirroredEvent[]> {
  const out: MirroredEvent[] = [];
  let pageToken: string | undefined;
  let tz = "UTC";
  do {
    const q = new URLSearchParams({
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await googleGet<{ items?: GEvent[]; nextPageToken?: string; timeZone?: string }>(
      `${API}/calendars/${encodeURIComponent(calendarId)}/events?${q}`,
      accessToken,
    );
    tz = page.timeZone ?? tz;
    for (const e of page.items ?? []) {
      const m = toMirror(calendarId, e, tz);
      if (m) out.push(m);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}
