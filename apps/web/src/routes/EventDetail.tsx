import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EventForm } from "../components/EventForm.js";
import { ShareEditor } from "../components/ShareEditor.js";
import { Button, Card, ErrorState, Spinner } from "../components/ui.js";
import { fmtDateTime } from "../lib/format.js";
import { useDeleteEvent, useEvent } from "../lib/queries.js";

export function EventDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const event = useEvent(id);
  const del = useDeleteEvent();
  const [editing, setEditing] = useState(false);

  if (event.isLoading) return <Spinner />;
  if (event.isError || !event.data) return <ErrorState error={event.error} retry={event.refetch} />;
  const e = event.data;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/calendar" className="flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} aria-hidden="true" /> Calendar
      </Link>
      <Card>
        {editing ? (
          <EventForm existing={e} onDone={() => setEditing(false)} />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold">{e.title}</h1>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    confirm("Delete this event?") &&
                    del.mutate(e.id, { onSuccess: () => nav("/calendar") })
                  }
                >
                  <Trash2 size={16} aria-hidden="true" /> Delete
                </Button>
              </div>
            </div>
            <p className="tnum text-sm text-muted">
              {fmtDateTime(e.startsAt)} – {fmtDateTime(e.endsAt)}
            </p>
            {e.location && <p className="text-sm">{e.location}</p>}
            {e.description && <p className="whitespace-pre-wrap text-sm text-muted">{e.description}</p>}
          </div>
        )}
      </Card>
      {!editing && <ShareEditor kind="event" id={e.id} />}
    </div>
  );
}
