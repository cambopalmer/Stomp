import type { CalendarEvent } from "@stomp/shared";
import { Link } from "react-router-dom";
import { groupByDay, isToday } from "../../lib/calendar.js";
import { fmtAgendaDay, fmtTimeRange } from "../../lib/format.js";
import { EmptyState } from "../ui.js";

/** Chronological list, grouped by day. Shows every event in the fetched window. */
export function AgendaView({ events }: { events: CalendarEvent[] }) {
  const groups = groupByDay(events);

  if (groups.length === 0) {
    return <EmptyState title="Nothing scheduled">Nothing in this range. Add an event or jump to another month.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ day, events: dayEvents }) => (
        <section key={day}>
          <h2
            className={`sticky top-0 z-10 -mx-1 bg-bg px-1 pb-1 text-sm font-semibold ${
              isToday(day) ? "text-primary" : "text-muted"
            }`}
          >
            {fmtAgendaDay(day)}
            {isToday(day) && <span className="ml-2 text-xs font-medium">Today</span>}
          </h2>
          <ul className="mt-1 flex flex-col gap-1.5">
            {dayEvents.map((e) => (
              <li key={e.id}>
                <Link
                  to={`/calendar/${e.id}`}
                  className="flex items-baseline gap-3 rounded-md border border-border bg-surface px-3 py-2 hover:shadow-md"
                >
                  <span className="tnum w-32 shrink-0 text-sm text-muted tabular-nums">
                    {e.allDay ? "All day" : fmtTimeRange(e.startsAt, e.endsAt)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{e.title}</span>
                    {e.location && <span className="ml-2 text-xs text-muted">{e.location}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
