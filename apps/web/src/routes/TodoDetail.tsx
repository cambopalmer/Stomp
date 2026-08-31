import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ActivityPanel } from "../components/ActivityPanel.js";
import { TagEditor } from "../components/TagEditor.js";
import { TodoForm } from "../components/TodoForm.js";
import { Button, Card, ErrorState, Input, Spinner } from "../components/ui.js";
import { relativeDay } from "../lib/format.js";
import {
  useCreateTodo,
  useDeleteTodo,
  useTodo,
  useUpdateTodo,
} from "../lib/queries.js";

export function TodoDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const todo = useTodo(id);
  const update = useUpdateTodo();
  const del = useDeleteTodo();
  const createSub = useCreateTodo();
  const [editing, setEditing] = useState(false);
  const [subtitle, setSubtitle] = useState("");

  if (todo.isLoading) return <Spinner />;
  if (todo.isError || !todo.data) return <ErrorState error={todo.error} retry={todo.refetch} />;
  const t = todo.data;

  const addSub = (e: FormEvent) => {
    e.preventDefault();
    if (!subtitle.trim()) return;
    createSub.mutate(
      { title: subtitle.trim(), parentTodoId: t.id },
      { onSuccess: () => setSubtitle("") },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Link to="/todos" className="flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} aria-hidden="true" /> Todos
      </Link>

      <Card>
        {editing ? (
          <TodoForm existing={t} onDone={() => setEditing(false)} />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold">{t.title}</h1>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  variant="danger"
                  onClick={() => confirm("Delete this todo and its subtasks?") && del.mutate(t.id, { onSuccess: () => nav("/todos") })}
                >
                  <Trash2 size={16} aria-hidden="true" /> Delete
                </Button>
              </div>
            </div>
            {t.notes && <p className="whitespace-pre-wrap text-sm text-muted">{t.notes}</p>}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted">Status</dt>
                <dd>{t.status.replace("_", " ")}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Priority</dt>
                <dd>{t.priority}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Deadline</dt>
                <dd className="tnum">{t.dueAt ? relativeDay(t.dueAt) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Planned</dt>
                <dd className="tnum">{t.scheduledFor ? relativeDay(t.scheduledFor) : "—"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              {["open", "in_progress", "blocked", "done"].map((st) => (
                <Button
                  key={st}
                  variant={t.status === st ? "primary" : "ghost"}
                  onClick={() => update.mutate({ id: t.id, body: { status: st as typeof t.status } })}
                >
                  {st.replace("_", " ")}
                </Button>
              ))}
            </div>
            <TagEditor entityType="todo" entityId={t.id} />
          </div>
        )}
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Subtasks <span className="tnum">({t.children.length})</span>
        </h2>
        <ul className="flex flex-col gap-1">
          {t.children.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
            >
              <input
                type="checkbox"
                checked={c.status === "done"}
                aria-label={`Mark subtask "${c.title}" ${c.status === "done" ? "not done" : "done"}`}
                onChange={() =>
                  update.mutate({
                    id: c.id,
                    body: { status: c.status === "done" ? "open" : "done" },
                  })
                }
                className="h-4 w-4 cursor-pointer"
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${c.status === "done" ? "text-muted line-through" : ""}`}
              >
                {c.title}
              </span>
              <button
                onClick={() => del.mutate(c.id)}
                aria-label={`Delete subtask ${c.title}`}
                className="text-muted hover:text-danger"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addSub} className="mt-2 flex gap-2">
          <label htmlFor="subtask" className="sr-only">
            New subtask
          </label>
          <Input
            id="subtask"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Add a subtask…"
            className="flex-1"
          />
          <Button type="submit" disabled={createSub.isPending}>
            <Plus size={16} aria-hidden="true" /> Add
          </Button>
        </form>
      </section>

      <ActivityPanel entityType="todo" entityId={t.id} />
    </div>
  );
}
