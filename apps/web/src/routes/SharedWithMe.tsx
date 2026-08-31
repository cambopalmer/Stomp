import { Link } from "react-router-dom";
import { EmptyState, ErrorState, Spinner } from "../components/ui.js";
import { fmtDateTime } from "../lib/format.js";
import { useSharedWithMe } from "../lib/queries.js";

export function SharedWithMe() {
  const shared = useSharedWithMe();
  if (shared.isLoading) return <Spinner />;
  if (shared.isError || !shared.data)
    return <ErrorState error={shared.error} retry={shared.refetch} />;

  const { todos, events, references } = shared.data;
  const empty = todos.length + events.length + references.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Shared with me</h1>
      <p className="text-sm text-muted">
        Items other people assigned or shared to you directly. Shared-workspace items appear under
        their workspace in the switcher.
      </p>

      {empty && <EmptyState title="Nothing shared with you yet" />}

      {todos.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Todos</h2>
          <ul className="flex flex-col gap-1">
            {todos.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/todos/${t.id}`}
                  className="block rounded-md border border-border bg-surface px-3 py-2 text-sm hover:shadow-md"
                >
                  {t.title}
                  {t.assigneeId && <span className="ml-2 text-xs text-muted">· assigned to you</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {events.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Events</h2>
          <ul className="flex flex-col gap-1">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  to={`/calendar/${e.id}`}
                  className="block rounded-md border border-border bg-surface px-3 py-2 text-sm hover:shadow-md"
                >
                  {e.title} <span className="tnum text-muted">· {fmtDateTime(e.startsAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {references.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
            References
          </h2>
          <ul className="flex flex-col gap-1">
            {references.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/learn/${r.id}`}
                  className="block rounded-md border border-border bg-surface px-3 py-2 text-sm hover:shadow-md"
                >
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
