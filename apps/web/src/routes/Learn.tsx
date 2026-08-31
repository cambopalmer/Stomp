import { referenceStatus } from "@stomp/shared";
import { Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ReferenceForm } from "../components/ReferenceForm.js";
import { Button, Card, EmptyState, ErrorState, Select, Spinner } from "../components/ui.js";
import { useReferences } from "../lib/queries.js";

const statusLabel: Record<string, string> = {
  to_learn: "To learn",
  learning: "Learning",
  learned: "Learned",
  archived: "Archived",
};

export function Learn() {
  const refs = useReferences();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [favOnly, setFavOnly] = useState(false);

  const filtered = useMemo(
    () =>
      (refs.data ?? []).filter(
        (r) => (!statusFilter || r.status === statusFilter) && (!favOnly || r.favorite),
      ),
    [refs.data, statusFilter, favOnly],
  );

  if (refs.isLoading) return <Spinner />;
  if (refs.isError) return <ErrorState error={refs.error} retry={refs.refetch} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Learn</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "New reference"}</Button>
      </div>

      {showForm && (
        <Card>
          <ReferenceForm onDone={() => setShowForm(false)} />
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="l-status" className="sr-only">
          Filter by status
        </label>
        <Select id="l-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Any status</option>
          {referenceStatus.options.map((o) => (
            <option key={o} value={o}>
              {statusLabel[o]}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} className="h-4 w-4" />
          Favorites only
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No references match" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r) => (
            <Link
              key={r.id}
              to={`/learn/${r.id}`}
              className="rounded-lg border border-border bg-surface p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                  {statusLabel[r.status]}
                </span>
                {r.favorite && <Star size={16} className="text-warning" aria-label="Favorite" />}
              </div>
              <p className="mt-1 font-medium">{r.title}</p>
              {r.description && <p className="line-clamp-2 text-sm text-muted">{r.description}</p>}
              <p className="mt-1 truncate text-xs text-muted">{safeHost(r.url)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
