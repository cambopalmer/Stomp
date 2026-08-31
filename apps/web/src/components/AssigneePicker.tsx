import type { Todo } from "@stomp/shared";
import { useUpdateTodo, useWorkspaceMembers } from "../lib/queries.js";
import { Field, Select } from "./ui.js";

export function AssigneePicker({ todo }: { todo: Todo }) {
  const members = useWorkspaceMembers(todo.workspaceId ?? undefined);
  const update = useUpdateTodo();

  if (!todo.workspaceId) {
    return <p className="text-sm text-muted">Move this todo into a workspace to assign it to someone.</p>;
  }

  return (
    <Field label="Assignee" htmlFor={`assignee-${todo.id}`}>
      <Select
        id={`assignee-${todo.id}`}
        value={todo.assigneeId ?? ""}
        onChange={(e) =>
          update.mutate({ id: todo.id, body: { assigneeId: e.target.value || null } })
        }
      >
        <option value="">— unassigned —</option>
        {members.data?.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.displayName}
          </option>
        ))}
      </Select>
    </Field>
  );
}
