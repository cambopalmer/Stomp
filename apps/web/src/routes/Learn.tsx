import { Star } from "lucide-react";
import { EmptyState, Spinner } from "../components/ui.js";
import { useReferences } from "../lib/queries.js";

const statusLabel: Record<string, string> = {
  to_learn: "To learn",
  learning: "Learning",
  learned: "Learned",
  archived: "Archived",
};

export function Learn() {
  const { data, isLoading } = useReferences();
  if (isLoading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Learn</h1>
      {!data?.length ? (
        <EmptyState title="No references yet">
          Saving links from the UI lands in Phase 1 — the API already supports it.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((r) => (
            <a
              key={r.id}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border bg-surface p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                  {statusLabel[r.status]}
                </span>
                {r.favorite && <Star size={16} className="text-warning" aria-label="Favorite" />}
              </div>
              <p className="mt-1 font-medium">{r.title}</p>
              {r.description && <p className="text-sm text-muted">{r.description}</p>}
              <p className="mt-1 truncate text-xs text-muted">{new URL(r.url).hostname}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
