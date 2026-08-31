import { zodResolver } from "@hookform/resolvers/zod";
import { createWorkspace, type Workspace } from "@stomp/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import {
  useAddWorkspaceMember,
  useCreateWorkspace,
  useWorkspaceMembers,
  useWorkspaces,
} from "../lib/queries.js";
import { useWorkspace } from "../lib/workspace.js";
import { Button, Card, EmptyState, ErrorState, Field, Input, Spinner } from "../components/ui.js";

export function Workspaces() {
  const workspaces = useWorkspaces();
  const [showForm, setShowForm] = useState(false);

  if (workspaces.isLoading) return <Spinner />;
  if (workspaces.isError) return <ErrorState error={workspaces.error} retry={workspaces.refetch} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Workspaces</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "New workspace"}</Button>
      </div>
      <p className="text-sm text-muted">
        Items in a workspace are visible to its members through shared projects. Personal items
        (workspace “Personal”) stay private to you.
      </p>

      {showForm && (
        <Card>
          <NewWorkspaceForm onDone={() => setShowForm(false)} />
        </Card>
      )}

      {!workspaces.data?.length ? (
        <EmptyState title="No workspaces yet">Create one to share work with someone.</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {workspaces.data.map((w) => (
            <WorkspaceCard key={w.id} workspace={w} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewWorkspaceForm({ onDone }: { onDone: () => void }) {
  type Values = z.infer<typeof createWorkspace>;
  const create = useCreateWorkspace();
  const { setActive } = useWorkspace();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(createWorkspace) });

  return (
    <form
      onSubmit={handleSubmit((v) =>
        create.mutate(v, {
          onSuccess: (w) => {
            setActive((w as Workspace).id);
            onDone();
          },
          onError: (e) => setError("name", { message: (e as Error).message }),
        }),
      )}
      className="flex flex-col gap-3"
    >
      <Field label="Name" htmlFor="w-name" error={errors.name?.message}>
        <Input id="w-name" autoFocus {...register("name")} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || create.isPending}>
          Create
        </Button>
      </div>
    </form>
  );
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const members = useWorkspaceMembers(workspace.id);
  const add = useAddWorkspaceMember();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const addMember = () => {
    if (!email.trim()) return;
    setErr(null);
    add.mutate(
      { id: workspace.id, body: { email: email.trim(), role: "editor" } },
      { onSuccess: () => setEmail(""), onError: (e) => setErr((e as Error).message) },
    );
  };

  return (
    <Card>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: workspace.color ?? "var(--color-muted-foreground)" }}
          aria-hidden="true"
        />
        <h2 className="font-semibold">{workspace.name}</h2>
      </div>
      {workspace.description && <p className="mt-1 text-sm text-muted">{workspace.description}</p>}

      <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Members</h3>
      <ul className="mt-1 flex flex-col gap-0.5 text-sm">
        {members.data?.map((m) => (
          <li key={m.userId} className="flex justify-between">
            <span>
              {m.displayName} <span className="text-muted">· {m.email}</span>
            </span>
            <span className="text-muted">{m.role}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex gap-2">
        <label className="sr-only" htmlFor={`m-${workspace.id}`}>
          Member email
        </label>
        <Input
          id={`m-${workspace.id}`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="flex-1"
        />
        <Button onClick={addMember} disabled={add.isPending}>
          Add member
        </Button>
      </div>
      {err && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {err}
        </p>
      )}
      <p className="mt-1 text-xs text-muted">
        The person needs an existing account. Seeded dev users: owner@stomp.local, sam@stomp.local.
      </p>
    </Card>
  );
}
