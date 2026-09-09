import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AgendaView } from "../components/calendar/AgendaView.js";
import { MonthView } from "../components/calendar/MonthView.js";
import { WeekView } from "../components/calendar/WeekView.js";
import { EventForm } from "../components/EventForm.js";
import { Button, Card, ErrorState, Spinner } from "../components/ui.js";
import { addDays, addMonths, monthGridDays, weekDays } from "../lib/calendar.js";
import { fmtMonthYear, fmtWeekRange } from "../lib/format.js";
import { useEvents } from "../lib/queries.js";

type View = "month" | "week" | "list";
const VIEWS: { id: View; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "list", label: "List" },
];

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (s: string | null): Date => {
  const d = s ? new Date(`${s}T00:00:00`) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

export function Calendar() {
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find((v) => v.id === params.get("view"))?.id ?? "month") as View;
  const anchor = fromIso(params.get("date"));

  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState<string | undefined>(undefined);

  const setView = (v: View) => setParams((p) => (p.set("view", v), p), { replace: true });
  const setAnchor = (d: Date) => setParams((p) => (p.set("date", toIso(d)), p), { replace: true });

  const step = (dir: 1 | -1) =>
    setAnchor(view === "week" ? addDays(anchor, dir * 7) : addMonths(anchor, dir));

  const range = useMemo(() => {
    const days = view === "week" ? weekDays(anchor) : monthGridDays(anchor);
    const first = days[0]!;
    const last = days[days.length - 1]!;
    return { from: first.getTime(), to: addDays(last, 1).getTime() };
  }, [view, anchor]);

  const events = useEvents(range);

  const title = useMemo(() => {
    if (view === "week") {
      const wd = weekDays(anchor);
      return fmtWeekRange(wd[0]!.getTime(), wd[6]!.getTime());
    }
    return fmtMonthYear(anchor.getTime());
  }, [view, anchor]);

  const openForm = (iso?: string) => {
    setFormDate(iso);
    setShowForm(true);
  };

  const openDayInWeek = (day: Date) =>
    setParams((p) => (p.set("view", "week"), p.set("date", toIso(day)), p), { replace: true });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">Calendar</h1>
          <div className="ml-1 flex items-center gap-1">
            <button
              onClick={() => step(-1)}
              aria-label="Previous"
              className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-surface-2"
            >
              Today
            </button>
            <button
              onClick={() => step(1)}
              aria-label="Next"
              className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="ml-1 text-sm font-medium text-muted tabular-nums">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Calendar view"
            className="flex rounded-md border border-border p-0.5 text-sm"
          >
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={`rounded px-2.5 py-1 font-medium ${
                  view === v.id ? "bg-primary text-primary-fg" : "text-muted hover:text-text"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <Button onClick={() => (showForm ? setShowForm(false) : openForm())}>
            {showForm ? "Close" : "New event"}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <EventForm
            key={formDate ?? "new"}
            defaultDate={formDate}
            onDone={() => setShowForm(false)}
          />
        </Card>
      )}

      {events.isLoading ? (
        <Spinner />
      ) : events.isError ? (
        <ErrorState error={events.error} retry={events.refetch} />
      ) : view === "month" ? (
        <MonthView
          anchor={anchor}
          events={events.data ?? []}
          onPickDate={openForm}
          onOpenDay={openDayInWeek}
        />
      ) : view === "week" ? (
        <WeekView anchor={anchor} events={events.data ?? []} />
      ) : (
        <AgendaView events={events.data ?? []} />
      )}
    </div>
  );
}
