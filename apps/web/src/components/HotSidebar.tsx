import { AlertTriangle, CalendarClock, Flame, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { fmtTime, relativeDay } from "../lib/format.js";
import { useHotList } from "../lib/queries.js";

const bucketLabel: Record<string, string> = {
  overdue: "Overdue",
  urgent: "Urgent",
  due_today: "Due today",
  high: "High priority",
  scheduled_today: "Planned today",
};

export function HotSidebar() {
  const { data, isLoading } = useHotList();

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;
  if (!data) return null;

  const groups = new Map<string, typeof data.todos>();
  for (const t of data.todos) {
    const list = groups.get(t.bucket) ?? [];
    list.push(t);
    groups.set(t.bucket, list);
  }
  const empty =
    data.todos.length === 0 && data.incoming.length === 0 && data.events.length === 0;

  return (
    <div className="sticky top-4 flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Flame size={16} className="text-accent" aria-hidden="true" />
        Hot &amp; relevant
      </h2>

      {empty && <p className="text-sm text-muted">All clear. Nothing needs you right now.</p>}

      {[...groups.entries()].map(([bucket, todos]) => (
        <section key={bucket}>
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            {bucket === "overdue" && <AlertTriangle size={12} className="text-danger" aria-hidden="true" />}
            {bucketLabel[bucket]}
          </h3>
          <ul className="flex flex-col gap-1">
            {todos.map((t) => (
              <li key={t.id}>
                <Link to="/todos" className="block truncate rounded px-1 py-0.5 text-sm hover:bg-surface-2">
                  {t.title}
                  {t.dueAt && (
                    <span className="ml-1 text-xs text-muted tnum">· {relativeDay(t.dueAt)}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {data.incoming.length > 0 && (
        <section>
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Inbox size={12} aria-hidden="true" /> Incoming ({data.incoming.length})
          </h3>
          <ul className="flex flex-col gap-1">
            {data.incoming.slice(0, 5).map((i) => (
              <li key={i.id}>
                <Link to="/incoming" className="block truncate rounded px-1 py-0.5 text-sm hover:bg-surface-2">
                  {i.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.events.length > 0 && (
        <section>
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <CalendarClock size={12} aria-hidden="true" /> Today
          </h3>
          <ul className="flex flex-col gap-1">
            {data.events.map((e) => (
              <li key={e.id} className="px-1 text-sm">
                <span className="tnum text-muted">{e.allDay ? "all day" : fmtTime(e.startsAt)}</span> · {e.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
