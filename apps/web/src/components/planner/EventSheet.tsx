import type { Category, PlannerEvent, TimeBlock } from "@stomp/shared";
import { CalendarDays, ExternalLink, Link2, MapPin, X } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { fmtDuration, fmtRange, PALETTE, tint, UNCATEGORIZED_HEX } from "../../lib/planner.js";
import { useCreateBlock } from "../../lib/queries.js";
import { Button, Input } from "../ui.js";
import { CategoryIcon } from "./CategoryIcon.js";

const DURATIONS = [15, 30, 45, 60];

/**
 * An event on the planner (ADR-0006, slice 5). Events stay read-only here;
 * what you can do is hang prep blocks off them — "Add before…" stacks each new
 * block in front of the earliest one already attached, so Drive then Dinner
 * line up before gymnastics. Attached blocks follow the event when it moves.
 */
export function EventSheet({
  date,
  event,
  attached,
  categories,
  onClose,
}: {
  date: string;
  event: PlannerEvent;
  /** this event's anchored blocks on this day */
  attached: TimeBlock[];
  categories: Category[];
  onClose: () => void;
}) {
  const live = categories.filter((c) => !c.archived);
  const travel = live.find((c) => c.name === "Travel" || c.icon === "car") ?? null;
  const first = attached.length === 0;
  const [title, setTitle] = useState(first ? "Travel" : "");
  const [minutes, setMinutes] = useState(30);
  const [categoryId, setCategoryId] = useState<string | null>(first ? (travel?.id ?? null) : null);
  const create = useCreateBlock();

  // stack before the earliest attached block, else right before the event
  const end = Math.min(event.startMin, ...attached.map((b) => b.startMin));
  const start = end - minutes;
  const fits = start >= 0;

  const headingId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!fits) return;
    const submitted = { title, categoryId };
    create.mutate(
      { date, startMin: start, endMin: end, title: title.trim(), categoryId, anchorEventId: event.id },
      {
        onSuccess: () => {
          // ready for the next one in the stack ("Dinner" before "Drive") — but never wipe
          // what the user already started typing while this one was saving
          setTitle((t) => (t === submitted.title ? "" : t));
          setCategoryId((c) => (c === submitted.categoryId ? null : c));
          titleRef.current?.focus();
        },
      },
    );
  };

  const sorted = [...attached].sort((a, b) => a.startMin - b.startMin);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div aria-hidden="true" className="absolute inset-0" style={{ background: "rgba(15, 23, 42, 0.45)" }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 shadow-xl sm:max-w-md sm:rounded-2xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 id={headingId} className="flex items-center gap-1.5 text-base font-semibold">
            <CalendarDays size={16} aria-hidden="true" className="shrink-0 text-muted" />
            {event.title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-2 text-muted hover:bg-surface-2">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="tnum text-sm text-muted">{fmtRange(event.startMin, event.endMin)}</p>
        {event.location && (
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
            <MapPin size={13} aria-hidden="true" /> {event.location}
          </p>
        )}
        <Link to={`/calendar/${event.id}`} className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Open event <ExternalLink size={12} aria-hidden="true" />
        </Link>

        {sorted.length > 0 && (
          <div className="mt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Before this</h3>
            <ul className="mt-1 flex flex-col gap-1" data-testid="event-attached">
              {sorted.map((b) => (
                <li key={b.id} className="tnum flex items-center gap-1.5 text-sm">
                  <Link2 size={13} aria-hidden="true" className="text-muted" />
                  <span className="font-medium">{b.title ?? b.todo?.title ?? "Block"}</span>
                  <span className="text-muted">· {fmtRange(b.startMin, b.endMin)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3 border-t border-border pt-3">
          <h3 className="text-sm font-semibold">Add before…</h3>
          <label className="flex flex-col gap-1 text-sm font-medium">
            What needs to happen first?
            <Input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={first ? "Travel" : "e.g. Dinner"}
              maxLength={200}
            />
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="How long">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => setMinutes(m)}
                className={`min-h-9 rounded-full border px-3 text-sm ${
                  minutes === m ? "border-primary bg-primary text-primary-fg" : "border-border hover:bg-surface-2"
                }`}
              >
                {fmtDuration(m)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
            {[null, ...live].map((c) => {
              const hex = c ? PALETTE[c.color] : UNCATEGORIZED_HEX;
              const on = categoryId === (c?.id ?? null);
              return (
                <button
                  key={c?.id ?? "none"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCategoryId(c?.id ?? null)}
                  className="flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm"
                  style={{ borderColor: on ? hex : undefined, background: on ? tint(hex, 0.16) : undefined }}
                >
                  <CategoryIcon icon={c?.icon ?? null} color={hex} /> {c?.name ?? "None"}
                </button>
              );
            })}
          </div>
          <p className="tnum text-xs text-muted" aria-live="polite">
            {fits ? `${fmtRange(start, end)} · moves with the event` : "Doesn’t fit before midnight — plan it on the day before instead."}
          </p>
          {create.isError && (
            <p role="alert" className="text-sm text-danger">
              {create.error instanceof Error ? create.error.message : "Couldn’t add it"}
            </p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={!fits || !title.trim() || create.isPending}>
              Add before
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
