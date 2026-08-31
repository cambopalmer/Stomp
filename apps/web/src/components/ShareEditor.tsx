import { X } from "lucide-react";
import { useState } from "react";
import { useAddCollaborator, useCollaborators, useRemoveCollaborator } from "../lib/queries.js";
import { Button, Field, Input, Select } from "./ui.js";

export function ShareEditor({
  kind,
  id,
}: {
  kind: "todo" | "event" | "reference";
  id: string;
}) {
  const collaborators = useCollaborators(kind, id);
  const add = useAddCollaborator();
  const remove = useRemoveCollaborator();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    if (!email.trim()) return;
    setErr(null);
    add.mutate(
      { kind, id, body: { email: email.trim(), role } },
      { onSuccess: () => setEmail(""), onError: (e) => setErr((e as Error).message) },
    );
  };

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Shared with</h2>
      {collaborators.data && collaborators.data.length > 0 ? (
        <ul className="mb-2 flex flex-col gap-1 text-sm">
          {collaborators.data.map((c) => (
            <li key={c.userId} className="flex items-center justify-between">
              <span>
                {c.displayName} <span className="text-muted">· {c.email}</span>
              </span>
              <span className="flex items-center gap-2 text-muted">
                {c.role}
                <button
                  onClick={() => remove.mutate({ kind, id, userId: c.userId })}
                  aria-label={`Remove ${c.displayName}`}
                  className="hover:text-danger"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-sm text-muted">Not shared with anyone.</p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Add someone" htmlFor={`share-${id}`}>
          <Input
            id={`share-${id}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </Field>
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
          aria-label="Role"
        >
          <option value="viewer">can view</option>
          <option value="editor">can edit</option>
        </Select>
        <Button onClick={submit} disabled={add.isPending}>
          Share
        </Button>
      </div>
      {err && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {err}
        </p>
      )}
      <p className="mt-1 text-xs text-muted">
        They get a note in their Incoming. Seeded dev users: owner@stomp.local, sam@stomp.local.
      </p>
    </section>
  );
}
