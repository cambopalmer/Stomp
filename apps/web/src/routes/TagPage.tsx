import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, ErrorState, Spinner } from "../components/ui.js";
import { fmtDateTime } from "../lib/format.js";
import { useTagItems, useTags } from "../lib/queries.js";

export function TagPage() {
  const { name } = useParams();
  const tags = useTags();
  const tagId = useMemo(
    () => tags.data?.find((t) => t.name.toLowerCase() === (name ?? "").toLowerCase())?.id,
    [tags.data, name],
  );
  const items = useTagItems(tagId);

  if (tags.isLoading || items.isLoading) return <Spinner />;
  if (!tagId) return <EmptyState title={`No tag named "${name}"`} />;
  if (items.isError || !items.data)
    return <ErrorState error={items.error} retry={items.refetch} />;

  const { todos, events, references } = items.data;
  const empty = todos.length + events.length + references.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/" className="flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} aria-hidden="true" /> Home
      </Link>
      <h1 className="text-xl font-bold">
        Tag: <span className="text-primary">{name}</span>
      </h1>

      {empty && <EmptyState title="Nothing is tagged with this yet" />}

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
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">References</h2>
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
