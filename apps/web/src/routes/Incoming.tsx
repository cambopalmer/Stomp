import type { IncomingItem } from "@stomp/shared";
import { CalendarPlus, ListPlus, X } from "lucide-react";
import { Button, Card, EmptyState, Spinner } from "../components/ui.js";
import { useIncoming, useTriage } from "../lib/queries.js";

const kindLabel: Record<string, string> = {
  capture: "Quick capture",
  email: "Email",
  shared_task: "Shared task",
  shared_event: "Shared event",
  system: "System",
};

function Item({ item }: { item: IncomingItem }) {
  const triage = useTriage();
  const busy = triage.isPending;

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
            {kindLabel[item.kind] ?? item.kind}
          </span>
          <p className="mt-1 font-medium">{item.title}</p>
          {item.body && <p className="mt-0.5 text-sm text-muted">{item.body}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => triage.mutate({ id: item.id, body: { target: "todo", title: item.title } })}
        >
          <ListPlus size={16} aria-hidden="true" /> To todo
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            const start = Date.now();
            triage.mutate({
              id: item.id,
              body: { target: "event", title: item.title, startsAt: start, endsAt: start + 3_600_000 },
            });
          }}
        >
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
    </Card>
  );
}

export function Incoming() {
  const { data, isLoading } = useIncoming();
  if (isLoading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Incoming</h1>
      {!data?.length ? (
        <EmptyState title="Inbox zero">Capture something from the banner and triage it here.</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((i) => (
            <Item key={i.id} item={i} />
          ))}
        </div>
      )}
    </div>
  );
}
