import { zodResolver } from "@hookform/resolvers/zod";
import { createProject } from "@stomp/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button, Card, EmptyState, Field, Input, Spinner, Textarea } from "../components/ui.js";
import { useCreateProject, useProjects } from "../lib/queries.js";

type FormValues = z.infer<typeof createProject>;

function NewProjectForm({ onDone }: { onDone: () => void }) {
  const create = useCreateProject();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(createProject) });

  return (
    <form
      onSubmit={handleSubmit((v) =>
        create.mutate(v, {
          onSuccess: onDone,
          onError: (e) => setError("name", { message: (e as Error).message }),
        }),
      )}
      className="flex flex-col gap-3"
    >
      <Field label="Name" htmlFor="p-name" error={errors.name?.message}>
        <Input id="p-name" autoFocus {...register("name")} />
      </Field>
      <Field label="Description" htmlFor="p-desc">
        <Textarea id="p-desc" {...register("description")} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || create.isPending}>
          Create project
        </Button>
      </div>
    </form>
  );
}

export function Projects() {
  const { data, isLoading } = useProjects();
  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Projects</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Close" : "New project"}</Button>
      </div>

      {showForm && (
        <Card>
          <NewProjectForm onDone={() => setShowForm(false)} />
        </Card>
      )}

      {(!data || data.length === 0) && <EmptyState title="No projects yet" />}

      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((p) => {
          const total = p.counts.todosOpen + p.counts.todosDone;
          const pct = total ? Math.round((p.counts.todosDone / total) * 100) : 0;
          return (
            <Card key={p.id}>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: p.color ?? "var(--color-muted-foreground)" }}
                  aria-hidden="true"
                />
                <h2 className="font-semibold">{p.name}</h2>
                {p.workspaceId && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                    shared
                  </span>
                )}
              </div>
              {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 tnum text-xs text-muted">
                  {p.counts.todosDone}/{total} todos · {p.counts.events} events ·{" "}
                  {p.counts.references} refs · {p.counts.incoming} incoming
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
