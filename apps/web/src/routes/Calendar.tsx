import { EmptyState, Spinner } from "../components/ui.js";
import { fmtDateTime } from "../lib/format.js";
import { useEvents } from "../lib/queries.js";

export function Calendar() {
  const { data, isLoading } = useEvents();
  if (isLoading) return <Spinner />;

  const now = Date.now();
  const upcoming = (data ?? []).filter((e) => e.endsAt >= now).sort((a, b) => a.startsAt - b.startsAt);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Calendar</h1>
      {upcoming.length === 0 ? (
        <EmptyState title="Nothing on the calendar">
          Event creation UI lands in Phase 1 — the API already supports it.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((e) => (
            <li key={e.id} className="rounded-md border border-border bg-surface px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{e.title}</span>
                <span className="tnum text-sm text-muted">
                  {e.allDay ? "All day" : fmtDateTime(e.startsAt)}
                </span>
              </div>
              {e.location && <p className="text-sm text-muted">{e.location}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
