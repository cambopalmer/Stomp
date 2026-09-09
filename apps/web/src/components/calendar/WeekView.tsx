import type { CalendarEvent } from "@stomp/shared";
import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  DAY_MS,
  eventsOnDay,
  isToday,
  layoutDay,
  sameDay,
  startOfDay,
  weekDays,
} from "../../lib/calendar.js";
import { fmtHour, fmtTimeRange, fmtWeekdayShort } from "../../lib/format.js";

const HOUR_PX = 44;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const GRID_H = HOUR_PX * 24;

export function WeekView({ anchor, events }: { anchor: Date; events: CalendarEvent[] }) {
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayEvents = days.map((d) => eventsOnDay(events, d));
  const hasAllDay = dayEvents.some((list) => list.some((e) => e.allDay));

  useEffect(() => {
    // open near the working day
    scrollRef.current?.scrollTo({ top: 7 * HOUR_PX });
  }, []);

  const now = Date.now();
  const nowTop = ((now - startOfDay(now).getTime()) / DAY_MS) * GRID_H;
  const cols = "3.25rem repeat(7, minmax(0, 1fr))";

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* day headers */}
      <div className="grid border-b border-border bg-surface" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map((d) => (
          <div key={d.getTime()} className="border-l border-border px-1 py-1.5 text-center">
            <div className="text-xs uppercase tracking-wide text-muted">{fmtWeekdayShort(d)}</div>
            <div
              className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm tabular-nums ${
                isToday(d) ? "bg-primary font-semibold text-primary-fg" : "text-text"
              }`}
            >
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* all-day strip (defensive: EventForm doesn't create these yet) */}
      {hasAllDay && (
        <div
          className="grid border-b border-border bg-surface-2/40"
          style={{ gridTemplateColumns: cols }}
        >
          <div className="px-1 py-1 text-right text-[10px] uppercase text-muted">all day</div>
          {days.map((d, i) => (
            <div key={d.getTime()} className="flex flex-col gap-0.5 border-l border-border p-1">
              {(dayEvents[i] ?? [])
                .filter((e) => e.allDay)
                .map((e) => (
                  <Link
                    key={e.id}
                    to={`/calendar/${e.id}`}
                    className="truncate rounded bg-primary/10 px-1 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    {e.title}
                  </Link>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* time grid */}
      <div ref={scrollRef} className="max-h-[62vh] overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: cols, height: GRID_H }}>
          {/* hour gutter */}
          <div className="relative">
            {HOURS.slice(1).map((h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-muted"
                style={{ top: h * HOUR_PX }}
              >
                {fmtHour(h)}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const positioned = layoutDay(eventsOnDay(events, day), day);
            return (
              <div key={day.getTime()} className="relative border-l border-border">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-border/60"
                    style={{ top: h * HOUR_PX }}
                  />
                ))}

                {sameDay(day, now) && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-danger"
                    style={{ top: nowTop }}
                  >
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-danger" />
                  </div>
                )}

                {positioned.map(({ event, top, height, col, cols: n }) => (
                  <Link
                    key={event.id}
                    to={`/calendar/${event.id}`}
                    title={`${event.title}${event.location ? ` · ${event.location}` : ""}`}
                    className="absolute overflow-hidden rounded border border-primary/30 bg-primary/15 px-1 py-0.5 text-xs text-primary hover:bg-primary/25"
                    style={{
                      top: `${top * 100}%`,
                      height: `calc(${height * 100}% - 2px)`,
                      left: `calc(${(col / n) * 100}% + 1px)`,
                      width: `calc(${(1 / n) * 100}% - 2px)`,
                    }}
                  >
                    <span className="block truncate font-medium">{event.title}</span>
                    <span className="tnum block truncate text-primary/70">
                      {fmtTimeRange(event.startsAt, event.endsAt)}
                    </span>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
