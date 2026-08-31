import type { Todo } from "@stomp/shared";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TodoForm } from "../components/TodoForm.js";
import { Button, Card, EmptyState, ErrorState, Select, Spinner } from "../components/ui.js";
import { priorityMeta, relativeDay } from "../lib/format.js";
import { useDeleteTodo, useProjects, useTodos, useUpdateTodo } from "../lib/queries.js";

const groupOrder = ["Overdue", "Today", "Upcoming", "Someday", "Done"] as const;
type Group = (typeof groupOrder)[number];

function groupOf(t: Todo): Group {
  if (t.status === "done" || t.status === "cancelled") return "Done";
  const day = new Date().setHours(0, 0, 0, 0);
  if (t.dueAt != null && t.dueAt < day) return "Overdue";
  const inToday = (ms: number | null) => ms != null && ms >= day && ms < day + 86_400_000;
  if ((t.dueAt != null && t.dueAt < day + 86_400_000) || inToday(t.scheduledFor)) return "Today";
  if (t.dueAt != null || t.scheduledFor != null) return "Upcoming";
  return "Someday";
}

export function TodoRow({ todo }: { todo: Todo }) {
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
      <Link
        to={`/todos/${todo.id}`}
        className={`min-w-0 flex-1 truncate text-sm hover:underline ${done ? "text-muted line-through" : ""}`}
      >
        {todo.title}
      </Link>
      {todo.priority !== "none" && (
        <span className={`text-xs font-medium ${pri.className}`}>{pri.label}</span>
      )}
      {todo.dueAt && <span className="tnum text-xs text-muted">{relativeDay(todo.dueAt)}</span>}
      <button
        onClick={() => confirm(`Delete "${todo.title}"?`) && del.mutate(todo.id)}
        aria-label={`Delete ${todo.title}`}
        className="text-muted hover:text-danger"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </li>
  );
}

export function Todos() {
  const todos = useTodos("?topLevel=true");
  const projects = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<Group, Todo[]>();
    for (const t of todos.data ?? []) {
      if (priorityFilter && t.priority !== priorityFilter) continue;
      if (projectFilter && t.projectId !== projectFilter) continue;
      const g = groupOf(t);
      map.set(g, [...(map.get(g) ?? []), t]);
    }
    return map;
  }, [todos.data, priorityFilter, projectFilter]);

  if (todos.isLoading) return <Spinner />;
  if (todos.isError) return <ErrorState error={todos.error} retry={todos.refetch} />;

  const total = [...grouped.values()].reduce((n, a) => n + a.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Todos</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "New todo"}</Button>
      </div>

      {showForm && (
        <Card>
          <TodoForm onDone={() => setShowForm(false)} />
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="f-priority">
          Filter by priority
        </label>
        <Select
          id="f-priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">Any priority</option>
          {["urgent", "high", "medium", "low", "none"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <label className="sr-only" htmlFor="f-project">
          Filter by project
        </label>
        <Select
          id="f-project"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="">Any project</option>
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      {total === 0 && (
        <EmptyState title="Nothing matches">
          {todos.data?.length ? "Try clearing the filters." : "Add a todo to get started."}
        </EmptyState>
      )}

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
                <TodoRow key={t.id} todo={t} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
