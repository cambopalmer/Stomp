import { zodResolver } from "@hookform/resolvers/zod";
import type { CalendarEvent } from "@stomp/shared";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateEvent, useProjects, useUpdateEvent } from "../lib/queries.js";
import { useWorkspace } from "../lib/workspace.js";
import { Button, Field, Input, Select, Textarea } from "./ui.js";

const schema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().optional(),
    location: z.string().optional(),
    date: z.string().min(1, "Pick a date"),
    startTime: z.string().min(1, "Start time"),
    endTime: z.string().min(1, "End time"),
    projectId: z.string().optional(),
  })
  .refine((v) => v.endTime >= v.startTime, { message: "End must be after start", path: ["endTime"] });
type Values = z.infer<typeof schema>;

const toLocalParts = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};
const combine = (date: string, time: string) => new Date(`${date}T${time}`).getTime();

export function EventForm({ existing, onDone }: { existing?: CalendarEvent; onDone: () => void }) {
  const projects = useProjects();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const { active } = useWorkspace();
  const busy = create.isPending || update.isPending;

  const s = existing ? toLocalParts(existing.startsAt) : null;
  const e = existing ? toLocalParts(existing.endsAt) : null;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: existing?.title ?? "",
      description: existing?.description ?? "",
      location: existing?.location ?? "",
      date: s?.date ?? "",
      startTime: s?.time ?? "09:00",
      endTime: e?.time ?? "10:00",
      projectId: existing?.projectId ?? "",
    },
  });

  const submit = handleSubmit((v) => {
    const body = {
      title: v.title,
      description: v.description || undefined,
      location: v.location || undefined,
      startsAt: combine(v.date, v.startTime),
      endsAt: combine(v.date, v.endTime),
      projectId: v.projectId || undefined,
      ...(existing ? {} : { workspaceId: active ?? undefined }),
    };
    const onError = (err: unknown) => setError("title", { message: (err as Error).message });
    if (existing) update.mutate({ id: existing.id, body }, { onSuccess: onDone, onError });
    else create.mutate(body, { onSuccess: onDone, onError });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Title" htmlFor="e-title" error={errors.title?.message}>
        <Input id="e-title" autoFocus {...register("title")} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Date" htmlFor="e-date" error={errors.date?.message}>
          <Input id="e-date" type="date" {...register("date")} />
        </Field>
        <Field label="Start" htmlFor="e-start" error={errors.startTime?.message}>
          <Input id="e-start" type="time" {...register("startTime")} />
        </Field>
        <Field label="End" htmlFor="e-end" error={errors.endTime?.message}>
          <Input id="e-end" type="time" {...register("endTime")} />
        </Field>
      </div>
      <Field label="Location" htmlFor="e-loc">
        <Input id="e-loc" {...register("location")} />
      </Field>
      <Field label="Description" htmlFor="e-desc">
        <Textarea id="e-desc" {...register("description")} />
      </Field>
      <Field label="Project" htmlFor="e-project">
        <Select id="e-project" {...register("projectId")}>
          <option value="">— none —</option>
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {existing ? "Save event" : "Add event"}
        </Button>
      </div>
    </form>
  );
}
