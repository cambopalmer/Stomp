import type { Todo } from "@stomp/shared";
import { Square } from "lucide-react";
import { Link } from "react-router";
import { isOverdue } from "../../lib/calendar.js";

/**
 * A todo on the calendar: an all-day item on its due date. Distinct from an
 * EventChip by shape (checkbox glyph, outlined) not just colour; overdue ones
 * turn danger. Links to the todo, not the event detail.
 */
export function TodoChip({ todo, className = "" }: { todo: Todo; className?: string }) {
  const overdue = isOverdue(todo);
  return (
    <Link
      to={`/todos/${todo.id}`}
      title={`Todo: ${todo.title}${overdue ? " (overdue)" : ""}`}
      data-kind="todo"
      className={`flex items-center gap-1 truncate rounded border px-1 py-0.5 text-xs font-medium hover:bg-surface-2 ${
        overdue ? "border-danger/40 text-danger" : "border-border bg-surface text-text"
      } ${className}`}
    >
      <Square size={11} aria-hidden className="shrink-0 opacity-70" />
      <span className="sr-only">Todo: </span>
      <span className="truncate">{todo.title}</span>
    </Link>
  );
}
