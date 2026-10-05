import type { CalendarEvent, Todo } from "@stomp/shared";
import { Square } from "lucide-react";
import { Link } from "react-router";
import { groupByDay, isOverdue, isToday } from "../../lib/calendar.js";
import { fmtAgendaDay, fmtTimeRange } from "../../lib/format.js";
import { EmptyState } from "../ui.js";

/** Chronological list, grouped by day. Shows every event and due todo in the fetched window. */
export function AgendaView({ events, todos }: { events: CalendarEvent[]; todos: Todo[] }) {
  const groups = groupByDay(events, todos);

  if (groups.length === 0) {
    return <EmptyState title="Nothing scheduled">Nothing in this range. Add an event or jump to another month.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ day, events: dayEvents, todos: dayTodos }) => (
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
            {dayTodos.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/todos/${t.id}`}
                  data-kind="todo"
                  className="flex items-baseline gap-3 rounded-md border border-dashed border-border bg-surface px-3 py-2 hover:shadow-md"
                >
                  <span
                    className={`flex w-32 shrink-0 items-center gap-1.5 text-sm ${isOverdue(t) ? "text-danger" : "text-muted"}`}
                  >
                    <Square size={12} aria-hidden className="translate-y-px" />
                    {isOverdue(t) ? "Overdue" : "Due"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="sr-only">Todo: </span>
                    <span className="font-medium">{t.title}</span>
                  </span>
                </Link>
              </li>
            ))}
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
