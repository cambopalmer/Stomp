import { X } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  useApplyTag,
  useCreateTag,
  useEntityTags,
  useRemoveTag,
  useTags,
} from "../lib/queries.js";
import { Input } from "./ui.js";

export function TagEditor({ entityType, entityId }: { entityType: string; entityId: string }) {
  const current = useEntityTags(entityType, entityId);
  const allTags = useTags();
  const apply = useApplyTag();
  const remove = useRemoveTag();
  const createTag = useCreateTag();
  const [input, setInput] = useState("");

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const name = input.trim();
    if (!name) return;
    const existing = allTags.data?.find((t) => t.name.toLowerCase() === name.toLowerCase());
    const tag = existing ?? (await createTag.mutateAsync(name));
    apply.mutate({ tagId: tag.id, entityType, entityId });
    setInput("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {current.data?.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: t.color ?? "var(--color-muted-foreground)" }}
            aria-hidden="true"
          />
          {t.name}
          <button
            onClick={() => remove.mutate({ tagId: t.id, entityType, entityId })}
            aria-label={`Remove tag ${t.name}`}
            className="text-muted hover:text-danger"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <form onSubmit={add}>
        <label className="sr-only" htmlFor={`tag-${entityId}`}>
          Add a tag
        </label>
        <Input
          id={`tag-${entityId}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="+ tag"
          className="h-7 w-24 py-0 text-xs"
          list="tag-suggestions"
        />
        <datalist id="tag-suggestions">
          {allTags.data?.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
        </datalist>
      </form>
    </div>
  );
}
