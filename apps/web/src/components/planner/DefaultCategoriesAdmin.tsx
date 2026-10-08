import { type CategoryColor, categoryColor, type CategoryIcon as IconKey, categoryIcon } from "@stomp/shared";
import { type FormEvent, useState } from "react";
import { PALETTE } from "../../lib/planner.js";
import { useAddDefaultCategory, useDefaultCategories, useDeleteDefaultCategory } from "../../lib/queries.js";
import { Button, Input, Select } from "../ui.js";
import { CategoryIcon } from "./CategoryIcon.js";

/**
 * The hub's starting categories for the day planner (ADR-0006). Adding one
 * reaches everyone (unless they already have that name); removing one only
 * affects people who start using the planner later.
 */
export function DefaultCategoriesAdmin() {
  const list = useDefaultCategories();
  const add = useAddDefaultCategory();
  const del = useDeleteDefaultCategory();
  const [name, setName] = useState("");
  const [color, setColor] = useState<CategoryColor>("sky");
  const [icon, setIcon] = useState<IconKey>("star");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate({ name: name.trim(), color, icon }, { onSuccess: () => setName("") });
  };

  return (
    <section aria-labelledby="defaults-h" className="flex flex-col gap-3">
      <div>
        <h2 id="defaults-h" className="text-base font-semibold">
          Planner default categories
        </h2>
        <p className="text-sm text-muted">
          Everyone starts with these. Adding one gives it to everyone (unless they already have one by that name);
          removing one only affects people who haven’t started using the planner yet.
        </p>
      </div>

      <ul className="flex flex-wrap gap-1.5" data-testid="default-categories">
        {list.data?.map((d) => (
          <li key={d.id} className="flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-2.5 pr-1 text-sm">
            <CategoryIcon icon={d.icon} color={PALETTE[d.color]} />
            {d.name}
            <button
              type="button"
              onClick={() => del.mutate(d.id)}
              disabled={del.isPending}
              aria-label={`Remove ${d.name} from the defaults`}
              className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className="w-44" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Colour
          <Select value={color} onChange={(e) => setColor(e.target.value as CategoryColor)} className="w-32">
            {categoryColor.options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Icon
          <Select value={icon} onChange={(e) => setIcon(e.target.value as IconKey)} className="w-40">
            {categoryIcon.options.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </label>
        <span className="flex h-10 items-center gap-1 text-sm" aria-hidden="true">
          <CategoryIcon icon={icon} color={PALETTE[color]} size={16} /> preview
        </span>
        <Button type="submit" disabled={add.isPending || !name.trim()}>
          Add for everyone
        </Button>
      </form>
      <p aria-live="polite" className="text-xs text-muted">
        {add.isSuccess
          ? `Added “${add.data.category.name}” — ${add.data.addedTo} ${add.data.addedTo === 1 ? "person" : "people"} got it.`
          : add.isError
            ? add.error instanceof Error
              ? add.error.message
              : "Couldn’t add it"
            : ""}
      </p>
    </section>
  );
}
