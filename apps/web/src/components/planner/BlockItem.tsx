import type { Category, TimeBlock } from "@stomp/shared";
import { CheckSquare, Link2 } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useEffect, useRef } from "react";
import { dragTo, fmtRange, MIN_PX, PALETTE, SLOT_MIN, tint, UNCATEGORIZED_HEX } from "../../lib/planner.js";
import { CategoryIcon } from "./CategoryIcon.js";

export type Times = { startMin: number; endMin: number };
type Pos = { top: number; height: number; left: string; width: string };

const LONG_PRESS_MS = 400;
const MOUSE_SLOP_PX = 4;
const TOUCH_SLOP_PX = 8;

/**
 * One block on the timeline. Direct manipulation (ADR-0006), each with a
 * non-drag alternative in the sheet (WCAG 2.5.7):
 *  - mouse: drag to move, drag the bottom edge to resize
 *  - touch: long-press, then drag to move (a plain swipe still scrolls)
 *  - keyboard: ↑/↓ move 15 min, Shift+↑/↓ resize
 */
export function BlockItem({
  block,
  category,
  style,
  onOpen,
  onPreview,
  onCommit,
}: {
  block: TimeBlock;
  category?: Category;
  style: Pos;
  onOpen: () => void;
  /** live position while dragging (null = drop the preview) */
  onPreview: (t: Times | null) => void;
  onCommit: (t: Times, how: "drag" | "key") => void;
}) {
  const hex = category ? PALETTE[category.color] : UNCATEGORIZED_HEX;
  const title = block.title ?? block.todo?.title ?? "Linked todo";
  const finished = block.status === "done" || !!block.todo?.done;
  const skipped = block.status === "skipped";
  const state = block.status === "done" ? ", done" : skipped ? ", skipped" : block.todo?.done ? ", todo complete" : "";
  const anchored = block.anchorEventId != null;

  const ref = useRef<HTMLButtonElement>(null);
  /** set after a drag so the trailing click doesn't open the sheet */
  const suppressClick = useRef(false);
  const latest = useRef({ block, onPreview, onCommit });
  latest.current = { block, onPreview, onCommit };

  // ── mouse / pen: pointer events ──
  // measure from where the drag began: while dragging, `block` already carries the preview times
  const drag = useRef<{ mode: "move" | "resize"; y0: number; active: boolean; orig: Times; last: Times } | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLElement>, mode: "move" | "resize") => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const orig = { startMin: block.startMin, endMin: block.endMin };
    drag.current = { mode, y0: e.clientY, active: false, orig, last: orig };
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y0;
    if (!d.active && Math.abs(dy) < MOUSE_SLOP_PX) return;
    d.active = true;
    d.last = dragTo(d.mode, d.orig, dy / MIN_PX);
    onPreview(d.last);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    suppressClick.current = true;
    if (d.last.startMin !== d.orig.startMin || d.last.endMin !== d.orig.endMin) onCommit(d.last, "drag");
    else onPreview(null);
  };

  // ── touch: long-press then drag (native listeners — touchmove must be cancelable) ──
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pressed = false;
    let y0 = 0;
    let last: Times | null = null;
    let orig: Times | null = null;

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      y0 = e.touches[0]!.clientY;
      pressed = false;
      last = null;
      const b0 = latest.current.block;
      orig = { startMin: b0.startMin, endMin: b0.endMin };
      timer = setTimeout(() => {
        pressed = true;
        last = orig;
        latest.current.onPreview(orig!); // "lifted"
        navigator.vibrate?.(10);
      }, LONG_PRESS_MS);
    };
    const move = (e: TouchEvent) => {
      const dy = e.touches[0]!.clientY - y0;
      if (!pressed) {
        if (Math.abs(dy) > TOUCH_SLOP_PX && timer) {
          clearTimeout(timer); // it's a scroll
          timer = null;
        }
        return;
      }
      e.preventDefault(); // we own this gesture now — don't scroll
      last = dragTo("move", orig!, dy / MIN_PX);
      latest.current.onPreview(last);
    };
    const end = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (!pressed) return;
      pressed = false;
      suppressClick.current = true;
      const { onPreview: preview, onCommit: commit } = latest.current;
      if (last && orig && (last.startMin !== orig.startMin || last.endMin !== orig.endMin)) commit(last, "drag");
      else preview(null);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      if (timer) clearTimeout(timer);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, []);

  // ── keyboard ──
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const by = e.key === "ArrowUp" ? -SLOT_MIN : SLOT_MIN;
    const next = dragTo(e.shiftKey ? "resize" : "move", block, by);
    if (next.startMin !== block.startMin || next.endMin !== block.endMin) onCommit(next, "key");
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onOpen();
      }}
      onPointerDown={(e) => onPointerDown(e, "move")}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
        onPreview(null);
      }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()} // long-press shouldn't pop the browser menu
      aria-label={`${title}, ${fmtRange(block.startMin, block.endMin)}${category ? `, ${category.name}` : ""}${state}${anchored ? ", attached to an event" : ""}${block.anchorLost ? ", its event was cancelled" : ""}`}
      aria-describedby="plan-block-keys"
      className={`absolute z-10 cursor-grab touch-pan-y select-none overflow-hidden rounded-md border border-l-4 px-1.5 py-0.5 text-left text-xs text-text [-webkit-touch-callout:none] hover:brightness-95 active:cursor-grabbing ${
        skipped ? "border-dashed opacity-60" : ""
      } ${block.anchorLost ? "ring-2 ring-warning" : ""}`}
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
        {finished ? (
          <CheckSquare size={12} aria-hidden="true" className="shrink-0 text-success" />
        ) : (
          <CategoryIcon icon={category?.icon} color={hex} size={12} />
        )}
        <span className={`truncate ${finished || skipped ? "line-through decoration-1" : ""}`}>{title}</span>
        {anchored && <Link2 size={11} aria-hidden="true" className="ml-auto shrink-0 text-muted" />}
      </span>
      {style.height > 30 && <span className="tnum block truncate text-muted">{fmtRange(block.startMin, block.endMin)}</span>}

      {/* bottom edge: mouse resize handle (touch resizes in the sheet) */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
        onPointerDown={(e) => onPointerDown(e, "resize")}
        data-testid="plan-block-resize"
      />
    </button>
  );
}
