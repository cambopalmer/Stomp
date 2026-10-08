import type { PlannerEvent, TrayTodo } from "@stomp/shared";
import { CalendarDays, ChevronLeft, Copy, ChevronRight, ListTodo, Plus, X } from "lucide-react";
import { type MouseEvent, type PointerEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { BlockItem, type Times } from "../components/planner/BlockItem.js";
import { BlockSheet, type SheetTarget } from "../components/planner/BlockSheet.js";
import { CopyDay } from "../components/planner/CopyDay.js";
import { DaySummary } from "../components/planner/DaySummary.js";
import { EventSheet } from "../components/planner/EventSheet.js";
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
  plannedIfMoved,
  rangeFrom,
  SLOT_MIN,
  snap,
} from "../lib/planner.js";
import { useCategories, usePlan, useUpdateBlock } from "../lib/queries.js";

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
  const [trayOpen, setTrayOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  /** a block mid-drag (or mid-save): drawn here instead of where the server has it */
  const [override, setOverride] = useState<({ id: string } & Times) | null>(null);
  /** drag-to-create preview on empty time */
  const [creating, setCreating] = useState<Times | null>(null);
  const [announce, setAnnounce] = useState("");
  const update = useUpdateBlock();
  const press = useRef<{ y0: number; min0: number } | null>(null);
  const lastPointer = useRef("mouse");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isToday = plan.data?.today === date;
  const nowMin = plan.data?.nowMin ?? 0;

  // open an hour before "now" today, otherwise at 8 am — once per day shown.
  // Wait for everything the grid needs: until both queries land it's a spinner, and
  // scrolling then would hit nothing (it raced when the plan arrived before categories).
  const gridReady = !!plan.data && !!cats.data;
  useEffect(() => {
    if (!gridReady || !scrollRef.current) return;
    const target = isToday ? Math.max(0, nowMin - 60) : 8 * 60;
    scrollRef.current.scrollTo({ top: target * MIN_PX });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, gridReady]);

  const catById = useMemo(() => new Map((cats.data ?? []).map((c) => [c.id, c])), [cats.data]);

  const go = (d: string) => nav(`/plan/${d}`);
  const addAtNextSlot = () =>
    setSheet({ kind: "new", startMin: isToday ? Math.min(snap(nowMin) + SLOT_MIN, DAY_MIN - SLOT_MIN) : 9 * 60 });

  const minAt = (e: { clientY: number; currentTarget: HTMLDivElement }) =>
    (e.clientY - e.currentTarget.getBoundingClientRect().top) / MIN_PX;
  // empty time: a tap adds at that slot; with a mouse, dragging sweeps out a range
  const onGridDown = (e: PointerEvent<HTMLDivElement>) => {
    lastPointer.current = e.pointerType;
    if (e.pointerType === "touch" || e.button !== 0) return; // touch: tap (click) adds, swipes scroll
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { y0: e.clientY, min0: minAt(e) };
  };
  const onGridMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || Math.abs(e.clientY - p.y0) < 6) return;
    setCreating(rangeFrom(p.min0, minAt(e)));
  };
  const onGridUp = () => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    const range = creating ?? { startMin: snap(p.min0), endMin: Math.min(DAY_MIN, snap(p.min0) + 2 * SLOT_MIN) };
    setCreating(null);
    setSheet({ kind: "new", ...range });
  };
  const onGridTap = (e: MouseEvent<HTMLDivElement>) => {
    if (lastPointer.current !== "touch") return; // mouse and pen are handled on pointer up
    setSheet({ kind: "new", startMin: snap(minAt(e)) });
  };

  if (plan.isLoading || cats.isLoading) return <Spinner />;
  if (plan.isError) return <ErrorState error={plan.error} retry={plan.refetch} />;
  if (cats.isError) return <ErrorState error={cats.error} retry={cats.refetch} />;
  const { blocks: serverBlocks, events, tray } = plan.data!;
  const blocks = override
    ? serverBlocks.map((b) => (b.id === override.id ? { ...b, startMin: override.startMin, endMin: override.endMin } : b))
    : serverBlocks;
  const started = date <= plan.data!.today;
  const commit = (id: string, t: Times, label: string) => {
    setOverride({ id, ...t });
    setAnnounce(`${label} moved to ${fmtRange(t.startMin, t.endMin)}`);
    update.mutate({ id, ...t }, { onSettled: () => setOverride(null) });
  };
  const scheduleTodo = (t: TrayTodo) => {
    setTrayOpen(false);
    setSheet({
      kind: "new",
      startMin: isToday ? Math.min(snap(nowMin) + SLOT_MIN, DAY_MIN - SLOT_MIN) : 9 * 60,
      todo: { id: t.id, title: t.title },
    });
  };
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
          <Button variant="ghost" onClick={() => setCopyOpen((v) => !v)} aria-expanded={copyOpen}>
            <Copy size={16} aria-hidden="true" /> Copy a day
          </Button>
          <Button onClick={addAtNextSlot}>
            <Plus size={16} aria-hidden="true" /> Add block
          </Button>
        </div>
      </div>

      {copyOpen && <CopyDay key={date} date={date} onClose={() => setCopyOpen(false)} />}

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

      {/* phones: the tray opens as a bottom sheet */}
      {tray.length > 0 && (
        <Button variant="ghost" className="lg:hidden" onClick={() => setTrayOpen(true)} aria-haspopup="dialog">
          <ListTodo size={16} aria-hidden="true" /> To schedule ({tray.length})
        </Button>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
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
            <div
              aria-hidden="true"
              className="absolute inset-0 cursor-copy"
              onPointerDown={onGridDown}
              onPointerMove={onGridMove}
              onPointerUp={onGridUp}
              onClick={onGridTap}
              data-testid="plan-tap-layer"
            />
            {creating && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-1 z-10 rounded-md border-2 border-dashed border-primary bg-primary/10"
                style={{ top: creating.startMin * MIN_PX, height: (creating.endMin - creating.startMin) * MIN_PX }}
                data-testid="plan-creating"
              />
            )}
            {/* planned vs actual: a faint outline where a block was planned before it moved */}
            {started &&
              blocks.map((b) => {
                const was = plannedIfMoved(b);
                return was ? (
                  <div
                    key={`ghost-${b.id}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1 rounded-md border border-dashed border-muted/60"
                    style={{ top: was.startMin * MIN_PX, height: (was.endMin - was.startMin) * MIN_PX - 2 }}
                    data-testid="plan-ghost"
                  />
                ) : null;
              })}

            {timedEvents.map((e) => (
              <EventItem key={e.id} event={e} style={pos(`e:${e.id}`, e.startMin, e.endMin)} onOpen={() => setEventOpen(e.id)} />
            ))}
            {blocks.map((b) => (
              <BlockItem
                key={b.id}
                block={b}
                category={b.categoryId ? catById.get(b.categoryId) : undefined}
                style={pos(`b:${b.id}`, b.startMin, b.endMin)}
                onOpen={() => setSheet({ kind: "edit", block: b })}
                onPreview={(t) => setOverride(t ? { id: b.id, ...t } : null)}
                onCommit={(t) => commit(b.id, t, b.title ?? b.todo?.title ?? "Block")}
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

      <div className="flex flex-col gap-3">
        {/* desktop: the tray sits alongside */}
        <aside aria-label="To schedule" className="hidden lg:block">
          <TrayList tray={tray} onSchedule={scheduleTodo} />
        </aside>
        <DaySummary date={date} blocks={blocks} categories={catById} started={started} notes={plan.data!.notes} />
      </div>
      </div>

      <p id="plan-block-keys" className="sr-only">
        Arrow keys move a block 15 minutes; Shift with arrows changes when it ends.
      </p>
      <p aria-live="polite" className="sr-only" data-testid="plan-announce">
        {announce}
      </p>

      {trayOpen && (
        <TraySheet onClose={() => setTrayOpen(false)}>
          <TrayList tray={tray} onSchedule={scheduleTodo} />
        </TraySheet>
      )}

      {blocks.length === 0 && (
        <p className="text-sm text-muted">Nothing planned yet — tap a time or use “Add block”.</p>
      )}

      {sheet && (
        <BlockSheet
          key={sheet.kind === "edit" ? sheet.block.id : `new-${sheet.startMin}-${sheet.endMin ?? ""}`}
          date={date}
          target={sheet}
          categories={cats.data ?? []}
          onClose={() => setSheet(null)}
          anchorTitle={
            sheet.kind === "edit" && sheet.block.anchorEventId
              ? events.find((e) => e.id === sheet.block.anchorEventId)?.title
              : undefined
          }
        />
      )}

      {eventOpen &&
        (() => {
          const ev = events.find((e) => e.id === eventOpen);
          return ev ? (
            <EventSheet
              date={date}
              event={ev}
              attached={serverBlocks.filter((b) => b.anchorEventId === ev.id)}
              categories={cats.data ?? []}
              onClose={() => setEventOpen(null)}
            />
          ) : null;
        })()}
    </div>
  );
}

type Pos = { top: number; height: number; left: string; width: string };

/** A calendar event: fixed and quiet. Opens the event sheet (prep blocks); edit the event itself in Calendar. */
function EventItem({ event, style, onOpen }: { event: PlannerEvent; style: Pos; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Event: ${event.title}, ${fmtRange(event.startMin, event.endMin)}`}
      title={`${event.title} · ${fmtRange(event.startMin, event.endMin)}${event.location ? ` · ${event.location}` : ""}`}
      className="absolute z-10 overflow-hidden rounded-md border border-dashed border-border bg-surface-2 px-1.5 py-0.5 text-left text-xs text-muted hover:text-text"
      style={style}
      data-testid="plan-event"
    >
      <span className="flex items-center gap-1 font-medium text-text">
        <CalendarDays size={12} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{event.title}</span>
      </span>
      {style.height > 30 && <span className="tnum block truncate">{fmtRange(event.startMin, event.endMin)}</span>}
    </button>
  );
}

const REASON: Record<TrayTodo["reason"], { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "border-danger/40 text-danger" },
  due: { label: "Due", className: "border-warning/40 text-warning" },
  planned: { label: "Planned", className: "border-border text-muted" },
};

/** Todos waiting for a time today (ADR-0006: "no time yet" lives here, not as time-less blocks). */
function TrayList({ tray, onSchedule }: { tray: TrayTodo[]; onSchedule: (t: TrayTodo) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <ListTodo size={15} aria-hidden="true" /> To schedule
      </h2>
      {tray.length === 0 ? (
        <p className="text-xs text-muted">Nothing waiting — todos planned for or due on this day show up here.</p>
      ) : (
        <ul className="flex flex-col gap-1.5" data-testid="plan-tray">
          {tray.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-md border border-border bg-surface p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.title}</p>
                <span className={`mt-0.5 inline-block rounded-full border px-1.5 text-[11px] ${REASON[t.reason].className}`}>
                  {REASON[t.reason].label}
                </span>
              </div>
              <Button
                variant="ghost"
                className="min-h-11 shrink-0 px-2.5 text-xs"
                onClick={() => onSchedule(t)}
                aria-label={`Schedule ${t.title}`}
              >
                Schedule
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TraySheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const headingId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div aria-hidden="true" className="absolute inset-0" style={{ background: "rgba(15, 23, 42, 0.45)" }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative max-h-[75dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 shadow-xl"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span id={headingId} className="sr-only">
            Todos to schedule
          </span>
          <span />
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-2 text-muted hover:bg-surface-2">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
