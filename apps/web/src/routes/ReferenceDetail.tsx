import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ReferenceForm } from "../components/ReferenceForm.js";
import { Button, Card, ErrorState, Spinner } from "../components/ui.js";
import { useDeleteReference, useReference } from "../lib/queries.js";

export function ReferenceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const ref = useReference(id);
  const del = useDeleteReference();
  const [editing, setEditing] = useState(false);

  if (ref.isLoading) return <Spinner />;
  if (ref.isError || !ref.data) return <ErrorState error={ref.error} retry={ref.refetch} />;
  const r = ref.data;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/learn" className="flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} aria-hidden="true" /> Learn
      </Link>
      <Card>
        {editing ? (
          <ReferenceForm existing={r} onDone={() => setEditing(false)} />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold">{r.title}</h1>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    confirm("Delete this reference?") &&
                    del.mutate(r.id, { onSuccess: () => nav("/learn") })
                  }
                >
                  <Trash2 size={16} aria-hidden="true" /> Delete
                </Button>
              </div>
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-sm text-primary underline"
            >
              {r.url} <ExternalLink size={14} aria-hidden="true" />
            </a>
            <p className="text-sm">
              <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                {r.status.replace("_", " ")}
              </span>
            </p>
            {r.description && <p className="whitespace-pre-wrap text-sm text-muted">{r.description}</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
