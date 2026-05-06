import { describe, expect, it } from "vitest";

import { buildHeatmapGrid, cellLevel, doseSeries, maxValue, monthLabelPositions } from "./streaks";
import type { HabitLogEntry } from "../types";

function makeLog(date: string, completed: boolean, value: string | null = null): HabitLogEntry {
  return { uuid: `u-${date}`, date, completed, value, note: "" };
}

describe("buildHeatmapGrid", () => {
  it("yields exactly 53 columns of 7 cells for a 365-day window", () => {
    // Pick a Wednesday so we hit a non-aligned end day.
    const grid = buildHeatmapGrid("2026-05-06", 365); // Wed
    expect(grid).toHaveLength(53);
    for (const col of grid) expect(col).toHaveLength(7);
  });

  it("places endDate in the right-most column at its day-of-week row", () => {
    const grid = buildHeatmapGrid("2026-05-06", 365); // Wed = row 3
    expect(grid.at(-1)?.[3]).toBe("2026-05-06");
  });

  it("masks the trailing blank cells after endDate", () => {
    const grid = buildHeatmapGrid("2026-05-06", 365); // Wed: rows 4..6 blank
    const lastCol = grid.at(-1)!;
    expect(lastCol[4]).toBeNull();
    expect(lastCol[5]).toBeNull();
    expect(lastCol[6]).toBeNull();
  });

  it("masks the leading blank cells before windowStart when start day is not Sunday", () => {
    const grid = buildHeatmapGrid("2026-05-06", 365);
    const firstCol = grid[0];
    // windowStart = 2026-05-06 - 364 = 2025-05-07 (Wednesday) → leadingPad=3.
    expect(firstCol[0]).toBeNull();
    expect(firstCol[1]).toBeNull();
    expect(firstCol[2]).toBeNull();
    expect(firstCol[3]).toBe("2025-05-07");
  });

  it("returns 365 non-null cells in total", () => {
    const grid = buildHeatmapGrid("2026-05-06", 365);
    const visible = grid.flat().filter(d => d !== null).length;
    expect(visible).toBe(365);
  });
});

describe("cellLevel", () => {
  it("returns 'untracked' when no log exists", () => {
    expect(cellLevel(undefined, 100)).toBe("untracked");
  });

  it("returns 'missed' when the log is not completed", () => {
    expect(cellLevel(makeLog("2026-05-06", false), 100)).toBe("missed");
  });

  it("returns 'l4' for completed days when no values are recorded anywhere", () => {
    expect(cellLevel(makeLog("2026-05-06", true), 0)).toBe("l4");
    expect(cellLevel(makeLog("2026-05-06", true, null), 100)).toBe("l4");
  });

  it("ramps levels by ratio of value to max", () => {
    expect(cellLevel(makeLog("2026-05-06", true, "10"), 100)).toBe("l1");
    expect(cellLevel(makeLog("2026-05-06", true, "40"), 100)).toBe("l2");
    expect(cellLevel(makeLog("2026-05-06", true, "70"), 100)).toBe("l3");
    expect(cellLevel(makeLog("2026-05-06", true, "100"), 100)).toBe("l4");
  });
});

describe("maxValue", () => {
  it("returns the largest numeric value among completed logs", () => {
    const logs = [
      makeLog("d1", true, "10"),
      makeLog("d2", true, "50"),
      makeLog("d3", true, "30"),
      makeLog("d4", false, "999"), // missed → ignored
    ];
    expect(maxValue(logs)).toBe(50);
  });

  it("returns 0 when no logs have values", () => {
    expect(maxValue([makeLog("d1", true, null)])).toBe(0);
  });
});

describe("doseSeries", () => {
  it("emits undefined for unlogged days, null for missed days, numbers for completed", () => {
    const logs = [
      makeLog("2026-05-04", true, "100"),
      makeLog("2026-05-05", false),
      // 2026-05-06 has no log
    ];
    const series = doseSeries(logs, "2026-05-06", 3);
    expect(series).toEqual([
      { date: "2026-05-04", value: 100 },
      { date: "2026-05-05", value: null },
      { date: "2026-05-06", value: undefined },
    ]);
  });
});

describe("monthLabelPositions", () => {
  it("emits one label per distinct month visible in the grid", () => {
    const grid = buildHeatmapGrid("2026-05-06", 90);
    const positions = monthLabelPositions(grid);
    const labels = positions.map(p => p.label);
    // 90 days back from May 6 lands in early February → Feb–May visible.
    expect(labels).toContain("FEB");
    expect(labels).toContain("MAR");
    expect(labels).toContain("APR");
    expect(labels).toContain("MAY");
  });
});
