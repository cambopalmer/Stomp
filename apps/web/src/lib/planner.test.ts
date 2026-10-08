import { describe, expect, it } from "vitest";
import { addDaysIso, fmtDuration, isoLocal, layoutSpans, snap, tint } from "./planner.js";

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
