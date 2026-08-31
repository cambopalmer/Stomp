import { useState } from "react";
import { Link } from "react-router-dom";
import { EventForm } from "../components/EventForm.js";
import { Button, Card, EmptyState, ErrorState, Spinner } from "../components/ui.js";
import { fmtDateTime, relativeDay } from "../lib/format.js";
import { useEvents } from "../lib/queries.js";

export function Calendar() {
  const events = useEvents();
  const [showForm, setShowForm] = useState(false);

  if (events.isLoading) return <Spinner />;
  if (events.isError) return <ErrorState error={events.error} retry={events.refetch} />;

  const now = Date.now();
  const upcoming = (events.data ?? [])
    .filter((e) => e.endsAt >= now)
    .sort((a, b) => a.startsAt - b.startsAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Calendar</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "New event"}</Button>
      </div>

      {showForm && (
        <Card>
          <EventForm onDone={() => setShowForm(false)} />
        </Card>
      )}

      {upcoming.length === 0 ? (
        <EmptyState title="Nothing coming up">Add an event to get started.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((e) => (
            <li key={e.id}>
              <Link
                to={`/calendar/${e.id}`}
                className="block rounded-md border border-border bg-surface px-3 py-2 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{e.title}</span>
                  <span className="tnum shrink-0 text-sm text-muted">
                    {e.allDay ? "All day" : fmtDateTime(e.startsAt)}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {relativeDay(e.startsAt)}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
