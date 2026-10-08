import { describe, expect, it } from "vitest";
import { addDaysIso, categoryTotals, dragTo, fmtDuration, isoLocal, layoutSpans, plannedIfMoved, rangeFrom, snap, tint } from "./planner.js";

describe("planner helpers", () => {
  it("snaps to the 15-minute grid and stays inside the day", () => {
    expect(snap(0)).toBe(0);
    expect(snap(14)).toBe(0);
    expect(snap(611)).toBe(600);
    expect(snap(-5)).toBe(0);
    expect(snap(1439)).toBe(1425); // a new block always has room to end by midnight
  });

  it("formats durations compactly", () => {
    expect(fmtDuration(15)).toBe("15m");
    expect(fmtDuration(60)).toBe("1h");
    expect(fmtDuration(90)).toBe("1h 30m");
  });

  it("walks dates in local time, across month ends", () => {
    expect(isoLocal(new Date(2031, 0, 5))).toBe("2031-01-05");
    expect(addDaysIso("2031-01-31", 1)).toBe("2031-02-01");
    expect(addDaysIso("2031-03-01", -1)).toBe("2031-02-28");
  });

  it("lays overlapping spans side by side; touching spans share a column", () => {
    const placed = layoutSpans([
      { id: "a", startMin: 540, endMin: 600 },
      { id: "b", startMin: 570, endMin: 630 }, // overlaps a
      { id: "c", startMin: 600, endMin: 660 }, // starts when a ends — reuses a's column
      { id: "solo", startMin: 720, endMin: 780 },
    ]);
    expect(placed.get("a")).toMatchObject({ col: 0, cols: 2 });
    expect(placed.get("b")).toMatchObject({ col: 1, cols: 2 });
    expect(placed.get("c")).toMatchObject({ col: 0, cols: 2 });
    expect(placed.get("solo")).toMatchObject({ col: 0, cols: 1 });
  });

  it("piles many items in one slot into separate columns (garbage in, still visible)", () => {
    const spans = Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, startMin: 600, endMin: 615 }));
    const placed = layoutSpans(spans);
    expect(new Set([...placed.values()].map((p) => p.col)).size).toBe(5);
    expect([...placed.values()].every((p) => p.cols === 5)).toBe(true);
  });

  it("tints a hex colour", () => {
    expect(tint("#2563eb", 0.15)).toBe("rgba(37, 99, 235, 0.15)");
  });
});

describe("slice 4 helpers", () => {
  it("moves keep duration, snap, and stay inside the day", () => {
    const b = { startMin: 600, endMin: 660 };
    expect(dragTo("move", b, 20)).toEqual({ startMin: 615, endMin: 675 }); // 20 → nearest slot 15
    expect(dragTo("move", b, -9999)).toEqual({ startMin: 0, endMin: 60 });
    expect(dragTo("move", b, 9999)).toEqual({ startMin: 1380, endMin: 1440 });
  });

  it("resizes the end, never shorter than one slot or past midnight", () => {
    const b = { startMin: 600, endMin: 660 };
    expect(dragTo("resize", b, 30)).toEqual({ startMin: 600, endMin: 690 });
    expect(dragTo("resize", b, -9999)).toEqual({ startMin: 600, endMin: 615 });
    expect(dragTo("resize", b, 9999)).toEqual({ startMin: 600, endMin: 1440 });
  });

  it("drag-to-create covers both directions and at least one slot", () => {
    expect(rangeFrom(545, 610)).toEqual({ startMin: 540, endMin: 615 });
    expect(rangeFrom(610, 545)).toEqual({ startMin: 540, endMin: 615 });
    expect(rangeFrom(600, 600)).toEqual({ startMin: 600, endMin: 615 });
  });

  it("totals by category, skipped excluded, largest first", () => {
    expect(
      categoryTotals([
        { categoryId: "work", startMin: 540, endMin: 720, status: "done" },
        { categoryId: "fam", startMin: 1080, endMin: 1140, status: "planned" },
        { categoryId: "work", startMin: 780, endMin: 840, status: "planned" },
        { categoryId: "fam", startMin: 1200, endMin: 1320, status: "skipped" },
        { categoryId: null, startMin: 0, endMin: 30, status: "planned" },
      ]),
    ).toEqual([
      { categoryId: "work", minutes: 240 },
      { categoryId: "fam", minutes: 60 },
      { categoryId: null, minutes: 30 },
    ]);
  });

  it("reports the planned time only when the block moved after starting", () => {
    expect(plannedIfMoved({ startMin: 600, endMin: 660, plannedStartMin: null, plannedEndMin: null })).toBeNull();
    expect(plannedIfMoved({ startMin: 600, endMin: 660, plannedStartMin: 600, plannedEndMin: 660 })).toBeNull();
    expect(plannedIfMoved({ startMin: 690, endMin: 750, plannedStartMin: 600, plannedEndMin: 660 })).toEqual({ startMin: 600, endMin: 660 });
  });
});
