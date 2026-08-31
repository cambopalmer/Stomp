import { zodResolver } from "@hookform/resolvers/zod";
import { priority } from "@stomp/shared";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { dateInputToMs } from "../lib/format.js";
import { useCreateTodo, useProjects } from "../lib/queries.js";
import { Button, Field, Input, Select, Textarea } from "./ui.js";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  notes: z.string().optional(),
  priority,
  dueDate: z.string().optional(),
  scheduledDate: z.string().optional(),
  projectId: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function TodoForm({
  onCreated,
  defaultProjectId,
}: {
  onCreated: () => void;
  defaultProjectId?: string;
}) {
  const projects = useProjects();
  const createTodo = useCreateTodo();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { priority: "none", projectId: defaultProjectId ?? "" },
  });

  const submit = handleSubmit((v) => {
    createTodo.mutate(
      {
        title: v.title,
        notes: v.notes || undefined,
        priority: v.priority,
        dueAt: dateInputToMs(v.dueDate ?? "") ?? undefined,
        scheduledFor: dateInputToMs(v.scheduledDate ?? "") ?? undefined,
        projectId: v.projectId || undefined,
      },
      {
        onSuccess: () => {
          reset({ priority: "none", projectId: defaultProjectId ?? "" });
          onCreated();
        },
        onError: (e) => setError("title", { message: (e as Error).message }),
      },
    );
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Title" htmlFor="t-title" error={errors.title?.message}>
        <Input id="t-title" autoFocus {...register("title")} aria-describedby="t-title-error" />
      </Field>
      <Field label="Notes" htmlFor="t-notes">
        <Textarea id="t-notes" {...register("notes")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority" htmlFor="t-priority">
          <Select id="t-priority" {...register("priority")}>
            {priority.options.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project" htmlFor="t-project">
          <Select id="t-project" {...register("projectId")}>
            <option value="">— none —</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deadline" htmlFor="t-due">
          <Input id="t-due" type="date" {...register("dueDate")} />
        </Field>
        <Field label="Plan for" htmlFor="t-sched" hint="The day you'll work it">
          <Input id="t-sched" type="date" {...register("scheduledDate")} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || createTodo.isPending}>
          Add todo
        </Button>
      </div>
    </form>
  );
}
