import type { Category, TimeBlock } from "@stomp/shared";
import { useState } from "react";
import { categoryTotals, fmtDuration, fmtRange, PALETTE, plannedIfMoved, UNCATEGORIZED_HEX } from "../../lib/planner.js";
import { useSaveDayNotes } from "../../lib/queries.js";
import { CategoryIcon } from "./CategoryIcon.js";

/**
 * The day at a glance (ADR-0006): time per category, and — once the day has
 * started — planned vs actual and how it went. Plus a free-text note.
 */
export function DaySummary({
  date,
  blocks,
  categories,
  started,
  notes,
}: {
  date: string;
  blocks: TimeBlock[];
  categories: Map<string, Category>;
  /** today or a past day — planned vs actual makes sense */
  started: boolean;
  notes: string;
}) {
  const totals = categoryTotals(blocks);
  const planned = totals.reduce((n, t) => n + t.minutes, 0);
  const moved = blocks
    .map((b) => ({ b, was: plannedIfMoved(b) }))
    .filter((x): x is { b: TimeBlock; was: NonNullable<ReturnType<typeof plannedIfMoved>> } => x.was != null);
  const done = blocks.filter((b) => b.status === "done").length;
  const skipped = blocks.filter((b) => b.status === "skipped").length;

  return (
    <section aria-labelledby="day-summary-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <h2 id="day-summary-h" className="text-sm font-semibold">
        {started ? "How the day went" : "The plan so far"}
      </h2>

      {totals.length === 0 ? (
        <p className="text-xs text-muted">No blocks yet.</p>
      ) : (
        <div>
          <ul className="flex flex-wrap gap-1.5" aria-label="Time by category" data-testid="day-totals">
            {totals.map((t) => {
              const c = t.categoryId ? categories.get(t.categoryId) : undefined;
              const hex = c ? PALETTE[c.color] : UNCATEGORIZED_HEX;
              return (
                <li key={t.categoryId ?? "none"} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
                  <CategoryIcon icon={c?.icon} color={hex} size={12} />
                  <span>{c?.name ?? "Uncategorized"}</span>
                  <span className="tnum text-muted">{fmtDuration(t.minutes)}</span>
                </li>
              );
            })}
          </ul>
          <p className="tnum mt-1.5 text-xs text-muted">
            {fmtDuration(planned)} planned
            {started && ` · ${done} done · ${skipped} skipped`}
          </p>
        </div>
      )}

      {started && moved.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Planned → actual</h3>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs" data-testid="day-moved">
            {moved.map(({ b, was }) => (
              <li key={b.id} className="tnum">
                <span className="font-medium">{b.title ?? b.todo?.title ?? "Block"}</span>: {fmtRange(was.startMin, was.endMin)} →{" "}
                {fmtRange(b.startMin, b.endMin)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DayNotes key={date} date={date} initial={notes} />
    </section>
  );
}

/** One note per day; saves when you leave the field. */
function DayNotes({ date, initial }: { date: string; initial: string }) {
  const [body, setBody] = useState(initial);
  const save = useSaveDayNotes();
  const dirty = body !== initial;
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
      Notes for the day
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => dirty && save.mutate({ date, body })}
        rows={3}
        maxLength={10_000}
        placeholder="What went well? What got in the way?"
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-normal normal-case tracking-normal text-text"
      />
      <span aria-live="polite" className="font-normal normal-case tracking-normal">
        {save.isPending ? "Saving…" : save.isError ? "Couldn’t save — try again" : save.isSuccess && !dirty ? "Saved" : ""}
      </span>
    </label>
  );
}
