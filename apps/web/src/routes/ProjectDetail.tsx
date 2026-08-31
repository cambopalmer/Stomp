import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { TodoForm } from "../components/TodoForm.js";
import { TodoRow } from "./Todos.js";
import { Button, Card, EmptyState, ErrorState, Spinner } from "../components/ui.js";
import { fmtDateTime } from "../lib/format.js";
import {
  useEvents,
  useIncoming,
  useProject,
  useProjects,
  useReferences,
  useTodos,
} from "../lib/queries.js";

const tabs = ["Todos", "Events", "References", "Incoming"] as const;
type Tab = (typeof tabs)[number];

export function ProjectDetail() {
  const { id } = useParams();
  const project = useProject(id);
  const projectsList = useProjects();
  const todos = useTodos(`?projectId=${id}`);
  const events = useEvents();
  const refs = useReferences();
  const incoming = useIncoming();
  const [tab, setTab] = useState<Tab>("Todos");
  const [showForm, setShowForm] = useState(false);

  const counts = useMemo(
    () => projectsList.data?.find((p) => p.id === id)?.counts,
    [projectsList.data, id],
  );

  if (project.isLoading) return <Spinner />;
  if (project.isError || !project.data)
    return <ErrorState error={project.error} retry={project.refetch} />;
  const p = project.data;

  const projEvents = (events.data ?? []).filter((e) => e.projectId === id);
  const projRefs = (refs.data ?? []).filter((r) => r.projectId === id);
  const projIncoming = (incoming.data ?? []).filter((i) => i.projectId === id);

  const total = (counts?.todosOpen ?? 0) + (counts?.todosDone ?? 0);
  const pct = total ? Math.round(((counts?.todosDone ?? 0) / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/projects" className="flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} aria-hidden="true" /> Projects
      </Link>

      <Card>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: p.color ?? "var(--color-muted-foreground)" }}
            aria-hidden="true"
          />
          <h1 className="text-xl font-bold">{p.name}</h1>
          {p.workspaceId && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
              shared
            </span>
          )}
        </div>
        {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 tnum text-xs text-muted">
          {counts?.todosDone ?? 0}/{total} todos done
        </p>
      </Card>

      <div role="tablist" aria-label="Project contents" className="flex gap-1 border-b border-border">
        {tabs.map((tb) => (
          <button
            key={tb}
            role="tab"
            aria-selected={tab === tb}
            onClick={() => setTab(tb)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === tb ? "border-b-2 border-primary text-text" : "text-muted hover:text-text"
            }`}
          >
            {tb}
          </button>
        ))}
      </div>

      {tab === "Todos" && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-end">
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "New todo"}</Button>
          </div>
          {showForm && (
            <Card>
              <TodoForm defaultProjectId={id} hideProject onDone={() => setShowForm(false)} />
            </Card>
          )}
          {todos.data?.length ? (
            <ul className="flex flex-col gap-1">
              {todos.data.filter((t) => !t.parentTodoId).map((t) => (
                <TodoRow key={t.id} todo={t} />
              ))}
            </ul>
          ) : (
            <EmptyState title="No todos in this project" />
          )}
        </div>
      )}

      {tab === "Events" &&
        (projEvents.length ? (
          <ul className="flex flex-col gap-2">
            {projEvents.map((e) => (
              <li key={e.id}>
                <Link to={`/calendar/${e.id}`} className="block rounded-md border border-border bg-surface px-3 py-2 hover:shadow-md">
                  <span className="font-medium">{e.title}</span>
                  <span className="tnum ml-2 text-sm text-muted">{fmtDateTime(e.startsAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No events in this project" />
        ))}

      {tab === "References" &&
        (projRefs.length ? (
          <ul className="flex flex-col gap-2">
            {projRefs.map((r) => (
              <li key={r.id}>
                <Link to={`/learn/${r.id}`} className="block rounded-md border border-border bg-surface px-3 py-2 hover:shadow-md">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No references in this project" />
        ))}

      {tab === "Incoming" &&
        (projIncoming.length ? (
          <ul className="flex flex-col gap-2">
            {projIncoming.map((i) => (
              <li key={i.id} className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
                {i.title}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing incoming for this project" />
        ))}
    </div>
  );
}
