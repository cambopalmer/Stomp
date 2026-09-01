import type { IncomingItem } from "@stomp/shared";
import { CalendarPlus, Check, ListPlus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { type FormEvent, useState } from "react";
import { Button, Card, EmptyState, ErrorState, Field, Input, Spinner, Textarea } from "../components/ui.js";
import { dateInputToMs } from "../lib/format.js";
import { useIncoming, useTriage } from "../lib/queries.js";

const kindLabel: Record<string, string> = {
  capture: "Quick capture",
  email: "Email",
  shared_task: "Shared task",
  shared_event: "Shared event",
  system: "System",
};

type Mode = null | "todo" | "event";

const linkFor = (item: IncomingItem) => {
  if (!item.linkedEntityId) return null;
  if (item.linkedEntityType === "todo") return `/todos/${item.linkedEntityId}`;
  if (item.linkedEntityType === "event") return `/calendar/${item.linkedEntityId}`;
  return null;
};

function Item({ item }: { item: IncomingItem }) {
  const triage = useTriage();
  const [mode, setMode] = useState<Mode>(null);
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.body ?? "");
  const [due, setDue] = useState("");
  const [date, setDate] = useState("");
  const busy = triage.isPending;
  const isShare = item.kind === "shared_task" || item.kind === "shared_event";
  const to = linkFor(item);

  const submitTodo = (e: FormEvent) => {
    e.preventDefault();
    triage.mutate({
      id: item.id,
      body: { target: "todo", title, notes: notes || undefined, dueAt: dateInputToMs(due) ?? undefined },
    });
  };
  const submitEvent = (e: FormEvent) => {
    e.preventDefault();
    const start = dateInputToMs(date) ?? Date.now();
    triage.mutate({
      id: item.id,
      body: { target: "event", title, startsAt: start + 9 * 3_600_000, endsAt: start + 10 * 3_600_000 },
    });
  };

  return (
    <Card>
      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
        {kindLabel[item.kind] ?? item.kind}
      </span>
      <p className="mt-1 font-medium">
        {to ? (
          <Link to={to} className="hover:underline">
            {item.title}
          </Link>
        ) : (
          item.title
        )}
      </p>
      {item.body && <p className="mt-0.5 text-sm text-muted">{item.body}</p>}

      {isShare ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => triage.mutate({ id: item.id, body: { target: "accept" } })}
          >
            <Check size={16} aria-hidden="true" /> Accept
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => triage.mutate({ id: item.id, body: { target: "decline" } })}
          >
            <X size={16} aria-hidden="true" /> Decline
          </Button>
        </div>
      ) : mode === null ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => setMode("todo")}>
            <ListPlus size={16} aria-hidden="true" /> To todo
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setMode("event")}>
            <CalendarPlus size={16} aria-hidden="true" /> To event
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => triage.mutate({ id: item.id, body: { target: "dismiss" } })}
          >
            <X size={16} aria-hidden="true" /> Dismiss
          </Button>
        </div>
      ) : null}

      {mode === "todo" && (
        <form onSubmit={submitTodo} className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <Field label="Title" htmlFor={`it-${item.id}`}>
            <Input id={`it-${item.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor={`in-${item.id}`}>
            <Textarea id={`in-${item.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Field label="Deadline" htmlFor={`id-${item.id}`}>
            <Input id={`id-${item.id}`} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create todo
            </Button>
          </div>
        </form>
      )}

      {mode === "event" && (
        <form onSubmit={submitEvent} className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <Field label="Title" htmlFor={`et-${item.id}`}>
            <Input id={`et-${item.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Date" htmlFor={`ed-${item.id}`} hint="Defaults to a 9–10am slot">
            <Input id={`ed-${item.id}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create event
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

export function Incoming() {
  const incoming = useIncoming();
  if (incoming.isLoading) return <Spinner />;
  if (incoming.isError) return <ErrorState error={incoming.error} retry={incoming.refetch} />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Incoming</h1>
      {!incoming.data?.length ? (
        <EmptyState title="Inbox zero">
          Capture something from the banner and triage it here.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {incoming.data.map((i) => (
            <Item key={i.id} item={i} />
          ))}
        </div>
      )}
    </div>
  );
}
