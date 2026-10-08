import type { Category, TimeBlock } from "@stomp/shared";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { DAY_MIN, fmtDuration, fmtMin, PALETTE, SLOT_MIN, tint, UNCATEGORIZED_HEX } from "../../lib/planner.js";
import { useCreateBlock, useDeleteBlock, useUpdateBlock } from "../../lib/queries.js";
import { Button, Input } from "../ui.js";
import { CategoryIcon } from "./CategoryIcon.js";

export type SheetTarget = { kind: "new"; startMin: number } | { kind: "edit"; block: TimeBlock };

const DURATIONS = [15, 30, 45, 60, 90];
const TIMES = Array.from({ length: DAY_MIN / SLOT_MIN + 1 }, (_, i) => i * SLOT_MIN);

/**
 * Add / edit a block (ADR-0006). A bottom sheet on phones, a dialog on wider
 * screens. Every time change has a tap alternative (−15 / +15, presets) —
 * nothing requires dragging (WCAG 2.2 SC 2.5.7).
 */
export function BlockSheet({
  date,
  target,
  categories,
  onClose,
  titleHint,
}: {
  date: string;
  target: SheetTarget;
  categories: Category[];
  onClose: () => void;
  /** placeholder when the block borrows its title from a linked todo */
  titleHint?: string;
}) {
  const editing = target.kind === "edit" ? target.block : null;
  const initialStart = editing ? editing.startMin : target.kind === "new" ? target.startMin : 0;
  const [title, setTitle] = useState(editing?.title ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(editing ? editing.endMin : Math.min(initialStart + 30, DAY_MIN));
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const create = useCreateBlock();
  const update = useUpdateBlock();
  const del = useDeleteBlock();
  const busy = create.isPending || update.isPending || del.isPending;
  const error = create.error ?? update.error ?? del.error;

  const headingId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const duration = end - start;
  /** move the whole block, keeping its length, inside the day */
  const shift = (by: number) => {
    const s = Math.min(Math.max(0, start + by), DAY_MIN - duration);
    setStart(s);
    setEnd(s + duration);
  };
  const resize = (by: number) => setEnd(Math.min(DAY_MIN, Math.max(start + SLOT_MIN, end + by)));
  const setDuration = (mins: number) => setEnd(Math.min(DAY_MIN, start + mins));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = { title: title.trim() || null, categoryId, notes: notes.trim() || null, startMin: start, endMin: end };
    if (editing) update.mutate({ id: editing.id, date, ...body }, { onSuccess: onClose });
    else create.mutate({ date, ...body }, { onSuccess: onClose });
  };

  const live = categories.filter((c) => !c.archived || c.id === categoryId);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      {/* backdrop: pointer convenience only — Escape and the × button are the accessible ways out */}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: "rgba(15, 23, 42, 0.45)" }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 shadow-xl sm:max-w-md sm:rounded-2xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id={headingId} className="text-base font-semibold">
            {editing ? "Edit block" : "New block"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-2 text-muted hover:bg-surface-2">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Title
            <Input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={titleHint ?? "What's this time for?"}
              maxLength={200}
            />
          </label>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Category</legend>
            <div className="flex flex-wrap gap-1.5">
              <Chip selected={categoryId === null} onClick={() => setCategoryId(null)} hex={UNCATEGORIZED_HEX}>
                <CategoryIcon icon={null} color={UNCATEGORIZED_HEX} /> None
              </Chip>
              {live.map((c) => (
                <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)} hex={PALETTE[c.color]}>
                  <CategoryIcon icon={c.icon} color={PALETTE[c.color]} /> {c.name}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              Time <span className="font-normal text-muted">· {fmtDuration(duration)}</span>
            </legend>
            <div className="flex items-center gap-2">
              <span className="w-10 text-sm text-muted">Start</span>
              <Stepper label="Start 15 minutes earlier" onClick={() => shift(-SLOT_MIN)} disabled={start === 0}>
                <Minus size={16} aria-hidden="true" />
              </Stepper>
              <TimeSelect
                label="Start time"
                value={start}
                options={TIMES.filter((t) => t < DAY_MIN)}
                onChange={(v) => {
                  setStart(v);
                  setEnd(Math.min(DAY_MIN, Math.max(v + SLOT_MIN, v + duration)));
                }}
              />
              <Stepper label="Start 15 minutes later" onClick={() => shift(SLOT_MIN)} disabled={end === DAY_MIN}>
                <Plus size={16} aria-hidden="true" />
              </Stepper>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 text-sm text-muted">End</span>
              <Stepper label="End 15 minutes earlier" onClick={() => resize(-SLOT_MIN)} disabled={duration <= SLOT_MIN}>
                <Minus size={16} aria-hidden="true" />
              </Stepper>
              <TimeSelect label="End time" value={end} options={TIMES.filter((t) => t > start)} onChange={setEnd} />
              <Stepper label="End 15 minutes later" onClick={() => resize(SLOT_MIN)} disabled={end === DAY_MIN}>
                <Plus size={16} aria-hidden="true" />
              </Stepper>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Duration">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={duration === m}
                  disabled={start + m > DAY_MIN}
                  onClick={() => setDuration(m)}
                  className={`min-h-9 rounded-full border px-3 text-sm ${
                    duration === m ? "border-primary bg-primary text-primary-fg" : "border-border hover:bg-surface-2"
                  } disabled:opacity-40`}
                >
                  {fmtDuration(m)}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Notes <span className="font-normal text-muted">(optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={5000}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error instanceof Error ? error.message : "Something went wrong"}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            {editing ? (
              <Button
                type="button"
                variant="danger"
                disabled={busy}
                onClick={() => del.mutate(editing.id, { onSuccess: onClose })}
              >
                <Trash2 size={16} aria-hidden="true" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={busy || (!title.trim() && !editing?.todoId)}>
              {editing ? "Save" : "Add block"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Chip({ selected, onClick, hex, children }: { selected: boolean; onClick: () => void; hex: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm"
      style={{ borderColor: selected ? hex : undefined, background: selected ? tint(hex, 0.16) : undefined }}
    >
      {children}
    </button>
  );
}

function Stepper({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-border hover:bg-surface-2 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function TimeSelect({ label, value, options, onChange }: { label: string; value: number; options: number[]; onChange: (v: number) => void }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="tnum h-11 flex-1 rounded-md border border-border bg-surface px-2 text-sm"
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {t === DAY_MIN ? "Midnight" : fmtMin(t)}
        </option>
      ))}
    </select>
  );
}
