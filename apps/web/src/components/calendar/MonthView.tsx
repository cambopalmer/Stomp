import type { CalendarEvent } from "@stomp/shared";
import { eventsOnDay, isToday, monthGridDays } from "../../lib/calendar.js";
import { fmtWeekdayShort } from "../../lib/format.js";
import { EventChip } from "./EventChip.js";

const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) =>
  fmtWeekdayShort(new Date(2024, 0, 7 + i)), // 2024-01-07 is a Sunday
);
const MAX_CHIPS = 3;

export function MonthView({
  anchor,
  events,
  onPickDate,
  onOpenDay,
}: {
  anchor: Date;
  events: CalendarEvent[];
  onPickDate: (isoDate: string) => void;
  onOpenDay: (day: Date) => void;
}) {
  const days = monthGridDays(anchor);
  const month = anchor.getMonth();

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-surface-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = day.getMonth() === month;
          const dayEvents = eventsOnDay(events, day);
          const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

          return (
            <div
              key={day.getTime()}
              className={`min-h-[104px] border-b border-r border-border p-1 last:border-r-0 ${
                inMonth ? "bg-surface" : "bg-surface-2/40"
              }`}
            >
              <button
                type="button"
                onClick={() => onPickDate(iso)}
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums ${
                  isToday(day)
                    ? "bg-primary font-semibold text-primary-fg"
                    : inMonth
                      ? "text-text hover:bg-surface-2"
                      : "text-muted hover:bg-surface-2"
                }`}
                aria-label={`Add event on ${iso}`}
              >
                {day.getDate()}
              </button>

              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, MAX_CHIPS).map((e) => (
                  <EventChip key={e.id} event={e} />
                ))}
                {dayEvents.length > MAX_CHIPS && (
                  <button
                    type="button"
                    onClick={() => onOpenDay(day)}
                    className="px-1 text-left text-xs text-muted hover:text-text"
                  >
                    +{dayEvents.length - MAX_CHIPS} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
