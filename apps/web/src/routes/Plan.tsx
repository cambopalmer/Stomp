import type { Category, PlannerEvent, TimeBlock } from "@stomp/shared";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { BlockSheet, type SheetTarget } from "../components/planner/BlockSheet.js";
import { CategoryIcon } from "../components/planner/CategoryIcon.js";
import { Button, ErrorState, Spinner } from "../components/ui.js";
import {
  addDaysIso,
  DAY_MIN,
  fmtDayTitle,
  fmtHourLabel,
  fmtRange,
  isoLocal,
  layoutSpans,
  MIN_PX,
  PALETTE,
  SLOT_MIN,
  snap,
  tint,
  UNCATEGORIZED_HEX,
} from "../lib/planner.js";
import { useCategories, usePlan } from "../lib/queries.js";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const GRID_H = DAY_MIN * MIN_PX;

/** `/plan` → today's plan, in this device's local date. */
export function PlanToday() {
  return <Navigate to={`/plan/${isoLocal(new Date())}`} replace />;
}

/** The day planner (ADR-0006): a mobile-first 15-minute timeline of blocks around fixed events. */
export function Plan() {
  const { date = isoLocal(new Date()) } = useParams();
  const nav = useNavigate();
  const plan = usePlan(date);
  const cats = useCategories();
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isToday = plan.data?.today === date;
  const nowMin = plan.data?.nowMin ?? 0;

  // open near "now" today, otherwise at 7 am — once per day shown
  useEffect(() => {
    if (!plan.data || !scrollRef.current) return;
    const target = isToday ? Math.max(0, nowMin - 90) : 7 * 60;
    scrollRef.current.scrollTo({ top: target * MIN_PX });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, !!plan.data]);

  const catById = useMemo(() => new Map((cats.data ?? []).map((c) => [c.id, c])), [cats.data]);

  const go = (d: string) => nav(`/plan/${d}`);
  const addAtNextSlot = () =>
    setSheet({ kind: "new", startMin: isToday ? Math.min(snap(nowMin) + SLOT_MIN, DAY_MIN - SLOT_MIN) : 9 * 60 });

  const onGridClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSheet({ kind: "new", startMin: snap((e.clientY - rect.top) / MIN_PX) });
  };

  if (plan.isLoading || cats.isLoading) return <Spinner />;
  if (plan.isError) return <ErrorState error={plan.error} retry={plan.refetch} />;
  if (cats.isError) return <ErrorState error={cats.error} retry={cats.refetch} />;
  const { blocks, events } = plan.data!;
  const allDay = events.filter((e) => e.allDay);
  const timedEvents = events.filter((e) => !e.allDay);
  const placed = layoutSpans([
    ...timedEvents.map((e) => ({ id: `e:${e.id}`, startMin: e.startMin, endMin: e.endMin })),
    ...blocks.map((b) => ({ id: `b:${b.id}`, startMin: b.startMin, endMin: b.endMin })),
  ]);
  const pos = (key: string, startMin: number, endMin: number) => {
    const p = placed.get(key) ?? { col: 0, cols: 1 };
    return {
      top: startMin * MIN_PX,
      height: Math.max((endMin - startMin) * MIN_PX - 2, MIN_PX * SLOT_MIN - 2),
      left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
      width: `calc(${100 / p.cols}% - 4px)`,
    };
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => go(addDaysIso(date, -1))} aria-label="Previous day" className="grid h-11 w-11 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text">
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <h1 className="min-w-0 text-lg font-bold">
            {fmtDayTitle(date)}
            {isToday && <span className="ml-2 text-xs font-medium text-primary">Today</span>}
          </h1>
          <button onClick={() => go(addDaysIso(date, 1))} aria-label="Next day" className="grid h-11 w-11 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text">
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!isToday && plan.data && (
            <Button variant="ghost" onClick={() => go(plan.data!.today)}>
              Today
            </Button>
          )}
          <Button onClick={addAtNextSlot}>
            <Plus size={16} aria-hidden="true" /> Add block
          </Button>
        </div>
      </div>

      {allDay.length > 0 && (
        <ul aria-label="All-day events" className="flex flex-wrap gap-1.5">
          {allDay.map((e) => (
            <li key={e.id}>
              <Link to={`/calendar/${e.id}`} className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-text">
                <CalendarDays size={13} aria-hidden="true" /> {e.title}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div ref={scrollRef} className="max-h-[72dvh] overflow-y-auto rounded-lg border border-border bg-surface" data-testid="plan-grid">
        <div className="relative grid" style={{ gridTemplateColumns: "3.25rem 1fr", height: GRID_H }}>
          <div className="relative" aria-hidden="true">
            {HOURS.slice(1).map((h) => (
              <span key={h} className="tnum absolute right-1.5 -translate-y-1/2 text-[11px] text-muted" style={{ top: h * 60 * MIN_PX }}>
                {fmtHourLabel(h)}
              </span>
            ))}
          </div>

          <div className="relative border-l border-border">
            {HOURS.map((h) => (
              <div key={h} aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-border/70" style={{ top: h * 60 * MIN_PX }}>
                <div className="absolute inset-x-0 border-t border-dashed border-border/40" style={{ top: 30 * MIN_PX }} />
              </div>
            ))}

            {/* pointer shortcut: tap empty time to add there (keyboard users: "Add block") */}
            <div aria-hidden="true" className="absolute inset-0 cursor-copy" onClick={onGridClick} data-testid="plan-tap-layer" />

            {timedEvents.map((e) => (
              <EventItem key={e.id} event={e} style={pos(`e:${e.id}`, e.startMin, e.endMin)} />
            ))}
            {blocks.map((b) => (
              <BlockItem
                key={b.id}
                block={b}
                category={b.categoryId ? catById.get(b.categoryId) : undefined}
                style={pos(`b:${b.id}`, b.startMin, b.endMin)}
                onOpen={() => setSheet({ kind: "edit", block: b })}
              />
            ))}

            {isToday && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-danger" style={{ top: nowMin * MIN_PX }}>
                <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-danger" />
              </div>
            )}
          </div>
        </div>
      </div>

      {blocks.length === 0 && (
        <p className="text-sm text-muted">Nothing planned yet — tap a time or use “Add block”.</p>
      )}

      {sheet && (
        <BlockSheet
          key={sheet.kind === "edit" ? sheet.block.id : `new-${sheet.startMin}`}
          date={date}
          target={sheet}
          categories={cats.data ?? []}
          onClose={() => setSheet(null)}
          titleHint={sheet.kind === "edit" && sheet.block.todoId ? "Linked todo" : undefined}
        />
      )}
    </div>
  );
}

type Pos = { top: number; height: number; left: string; width: string };

/** A calendar event: fixed, quiet, links to the event (edit it in Calendar, not here). */
function EventItem({ event, style }: { event: PlannerEvent; style: Pos }) {
  return (
    <Link
      to={`/calendar/${event.id}`}
      title={`${event.title} · ${fmtRange(event.startMin, event.endMin)}${event.location ? ` · ${event.location}` : ""}`}
      className="absolute z-10 overflow-hidden rounded-md border border-dashed border-border bg-surface-2 px-1.5 py-0.5 text-xs text-muted hover:text-text"
      style={style}
    >
      <span className="flex items-center gap-1 font-medium text-text">
        <CalendarDays size={12} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{event.title}</span>
      </span>
      {style.height > 30 && <span className="tnum block truncate">{fmtRange(event.startMin, event.endMin)}</span>}
    </Link>
  );
}

function BlockItem({
  block,
  category,
  style,
  onOpen,
}: {
  block: TimeBlock;
  category?: Category;
  style: Pos;
  onOpen: () => void;
}) {
  const hex = category ? PALETTE[category.color] : UNCATEGORIZED_HEX;
  const title = block.title ?? "Linked todo";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${title}, ${fmtRange(block.startMin, block.endMin)}${category ? `, ${category.name}` : ""}`}
      className="absolute z-10 overflow-hidden rounded-md border border-l-4 px-1.5 py-0.5 text-left text-xs text-text hover:brightness-95"
      // tint over the opaque card colour, so grid lines don't show through
      style={{
        ...style,
        borderColor: tint(hex, 0.45),
        borderLeftColor: hex,
        background: `linear-gradient(${tint(hex, 0.14)}, ${tint(hex, 0.14)}), var(--color-card)`,
      }}
      data-testid="plan-block"
    >
      <span className="flex items-center gap-1 font-medium">
        <CategoryIcon icon={category?.icon} color={hex} size={12} />
        <span className="truncate">{title}</span>
      </span>
      {style.height > 30 && <span className="tnum block truncate text-muted">{fmtRange(block.startMin, block.endMin)}</span>}
    </button>
  );
}
