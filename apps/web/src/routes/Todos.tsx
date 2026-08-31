import type { Todo } from "@stomp/shared";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { TodoForm } from "../components/TodoForm.js";
import { Button, Card, EmptyState, Spinner } from "../components/ui.js";
import { priorityMeta, relativeDay } from "../lib/format.js";
import { useDeleteTodo, useTodos, useUpdateTodo } from "../lib/queries.js";

const groupOrder = ["Overdue", "Today", "Upcoming", "Someday", "Done"] as const;
type Group = (typeof groupOrder)[number];

function groupOf(t: Todo): Group {
  if (t.status === "done" || t.status === "cancelled") return "Done";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getTime();
  if (t.dueAt != null && t.dueAt < day) return "Overdue";
  if ((t.dueAt != null && t.dueAt < day + 86_400_000) || (t.scheduledFor != null && t.scheduledFor >= day && t.scheduledFor < day + 86_400_000))
    return "Today";
  if (t.dueAt != null || t.scheduledFor != null) return "Upcoming";
  return "Someday";
}

function Row({ todo }: { todo: Todo }) {
  const update = useUpdateTodo();
  const del = useDeleteTodo();
  const done = todo.status === "done";
  const pri = priorityMeta[todo.priority];

  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <input
        type="checkbox"
        checked={done}
        aria-label={done ? `Mark "${todo.title}" not done` : `Mark "${todo.title}" done`}
        onChange={() => update.mutate({ id: todo.id, body: { status: done ? "open" : "done" } })}
        className="h-4 w-4 shrink-0 cursor-pointer"
      />
      <span className={`min-w-0 flex-1 truncate text-sm ${done ? "text-muted line-through" : ""}`}>
        {todo.title}
      </span>
      {todo.priority !== "none" && (
        <span className={`text-xs font-medium ${pri.className}`}>{pri.label}</span>
      )}
      {todo.dueAt && <span className="tnum text-xs text-muted">{relativeDay(todo.dueAt)}</span>}
      <button
        onClick={() => {
          if (confirm(`Delete "${todo.title}"?`)) del.mutate(todo.id);
        }}
        aria-label={`Delete ${todo.title}`}
        className="text-muted hover:text-danger"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </li>
  );
}

export function Todos() {
  const { data, isLoading } = useTodos("?topLevel=true");
  const [showForm, setShowForm] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<Group, Todo[]>();
    for (const t of data ?? []) {
      const g = groupOf(t);
      const arr = map.get(g) ?? [];
      arr.push(t);
      map.set(g, arr);
    }
    return map;
  }, [data]);

  if (isLoading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Todos</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "New todo"}</Button>
      </div>

      {showForm && (
        <Card>
          <TodoForm onCreated={() => setShowForm(false)} />
        </Card>
      )}

      {(!data || data.length === 0) && <EmptyState title="No todos yet">Add one to get started.</EmptyState>}

      {groupOrder.map((g) => {
        const items = grouped.get(g);
        if (!items?.length) return null;
        return (
          <section key={g}>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
              {g} <span className="tnum">({items.length})</span>
            </h2>
            <ul className="flex flex-col gap-1">
              {items.map((t) => (
                <Row key={t.id} todo={t} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
