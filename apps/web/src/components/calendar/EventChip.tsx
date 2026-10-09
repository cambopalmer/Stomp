import type { CalendarEvent } from "@stomp/shared";
import { Link } from "react-router";
import { fmtTime } from "../../lib/format.js";

/** Compact event pill used in the month grid. */
export function EventChip({ event, className = "" }: { event: CalendarEvent; className?: string }) {
  return (
    <Link
      to={`/calendar/${event.id}`}
      title={`${event.title}${event.location ? ` · ${event.location}` : ""}`}
      className={`block truncate rounded-sm px-1 py-0.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 ${className}`}
    >
      {!event.allDay && (
        <span className="tnum mr-1 tabular-nums text-primary/70">{fmtTime(event.startsAt)}</span>
      )}
      {event.title}
    </Link>
  );
}
