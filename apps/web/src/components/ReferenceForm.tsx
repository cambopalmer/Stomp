import { zodResolver } from "@hookform/resolvers/zod";
import { type Reference, referenceStatus } from "@stomp/shared";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateReference, useProjects, useUpdateReference } from "../lib/queries.js";
import { Button, Field, Input, Select, Textarea } from "./ui.js";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  url: z.string().url("Must be a valid URL"),
  description: z.string().optional(),
  status: referenceStatus,
  favorite: z.boolean(),
  projectId: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function ReferenceForm({ existing, onDone }: { existing?: Reference; onDone: () => void }) {
  const projects = useProjects();
  const create = useCreateReference();
  const update = useUpdateReference();
  const busy = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: existing?.title ?? "",
      url: existing?.url ?? "",
      description: existing?.description ?? "",
      status: existing?.status ?? "to_learn",
      favorite: existing?.favorite ?? false,
      projectId: existing?.projectId ?? "",
    },
  });

  const submit = handleSubmit((v) => {
    const body = {
      title: v.title,
      url: v.url,
      description: v.description || undefined,
      status: v.status,
      favorite: v.favorite,
      projectId: v.projectId || undefined,
    };
    const onError = (err: unknown) => setError("url", { message: (err as Error).message });
    if (existing) update.mutate({ id: existing.id, body }, { onSuccess: onDone, onError });
    else create.mutate(body, { onSuccess: onDone, onError });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="URL" htmlFor="r-url" error={errors.url?.message}>
        <Input id="r-url" autoFocus placeholder="https://…" {...register("url")} />
      </Field>
      <Field label="Title" htmlFor="r-title" error={errors.title?.message}>
        <Input id="r-title" {...register("title")} />
      </Field>
      <Field label="Notes" htmlFor="r-desc">
        <Textarea id="r-desc" {...register("description")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status" htmlFor="r-status">
          <Select id="r-status" {...register("status")}>
            {referenceStatus.options.map((o) => (
              <option key={o} value={o}>
                {o.replace("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Project" htmlFor="r-project">
          <Select id="r-project" {...register("projectId")}>
            <option value="">— none —</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("favorite")} className="h-4 w-4" />
        Favorite
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {existing ? "Save reference" : "Add reference"}
        </Button>
      </div>
    </form>
  );
}
