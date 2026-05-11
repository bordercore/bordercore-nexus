import { describe, expect, it } from "vitest";

import {
  ARCHIVE_YEAR_CEILING,
  ageTone,
  filtersEqual,
  fmtDate,
  matchesFilter,
  relDate,
  yearOf,
  yearSwatch,
} from "./nodeListUtils";
import type { NodeListItem } from "./types";

// Midday ISO strings avoid timezone edge cases around day/year boundaries.
const DATE_2026 = "2026-04-15T12:00:00Z";
const DATE_2025 = "2025-06-10T12:00:00Z";
const DATE_2024 = "2024-07-20T12:00:00Z";
const DATE_2023 = "2023-03-01T12:00:00Z";
const DATE_2022 = "2022-08-22T12:00:00Z";
const DATE_2019 = "2019-01-15T12:00:00Z";

function makeNode(overrides: Partial<NodeListItem> = {}): NodeListItem {
  return {
    uuid: "00000000-0000-0000-0000-000000000000",
    name: "node_0",
    modified: DATE_2026,
    collection_count: 0,
    todo_count: 0,
    ...overrides,
  };
}

describe("yearOf", () => {
  it("extracts the year from an ISO date", () => {
    expect(yearOf(DATE_2026)).toBe(2026);
    expect(yearOf(DATE_2022)).toBe(2022);
  });
});

describe("ageTone", () => {
  it.each<[string, string]>([
    [DATE_2026, "fresh"],
    [DATE_2025, "recent"],
    [DATE_2024, "current"],
    [DATE_2023, "older"],
    [DATE_2022, "archive"],
    [DATE_2019, "archive"],
  ])("labels %s as %s", (iso, label) => {
    expect(ageTone(iso).label).toBe(label);
  });

  it("returns rail and glow colors for every tier", () => {
    for (const iso of [DATE_2026, DATE_2025, DATE_2024, DATE_2023, DATE_2022]) {
      const tone = ageTone(iso);
      expect(tone.rail).toMatch(/^var\(--[\w-]+\)$/);
      expect(tone.glow).toMatch(/^color-mix\(/);
    }
  });
});

describe("yearSwatch", () => {
  it("returns distinct swatches across tier boundaries", () => {
    const swatches = [2026, 2025, 2024, 2023, 2020].map(yearSwatch);
    expect(new Set(swatches).size).toBe(swatches.length);
  });

  it("uses the archive swatch for years at or below the archive ceiling", () => {
    expect(yearSwatch(ARCHIVE_YEAR_CEILING)).toBe(yearSwatch(2019));
  });
});

describe("fmtDate", () => {
  it("formats a date with lowercase month, day, year", () => {
    expect(fmtDate(DATE_2026)).toMatch(/^[a-z]{3} \d{1,2}, 2026$/);
  });
});

describe("relDate", () => {
  const now = new Date("2026-04-15T12:00:00Z");

  it("says 'just now' for sub-minute diffs", () => {
    const iso = new Date(now.getTime() - 30_000).toISOString();
    expect(relDate(iso, now)).toBe("just now");
  });

  it("renders minutes, hours, days, weeks, months, years", () => {
    const cases: [number, string][] = [
      [5 * 60, "5m ago"],
      [3 * 3600, "3h ago"],
      [2 * 86400, "2d ago"],
      [2 * 86400 * 7, "2w ago"],
      [3 * 86400 * 30, "3mo ago"],
      [2 * 86400 * 365, "2y ago"],
    ];
    for (const [seconds, expected] of cases) {
      const iso = new Date(now.getTime() - seconds * 1000).toISOString();
      expect(relDate(iso, now)).toBe(expected);
    }
  });
});

describe("matchesFilter", () => {
  it("matches everything when filter is 'all'", () => {
    expect(matchesFilter(makeNode(), { type: "all" })).toBe(true);
    expect(matchesFilter(makeNode({ pinned: true }), { type: "all" })).toBe(true);
  });

  it("matches only pinned nodes", () => {
    expect(matchesFilter(makeNode({ pinned: true }), { type: "pinned" })).toBe(true);
    expect(matchesFilter(makeNode({ pinned: false }), { type: "pinned" })).toBe(false);
    expect(matchesFilter(makeNode(), { type: "pinned" })).toBe(false);
  });

  it("matches nodes that have at least one todo", () => {
    expect(matchesFilter(makeNode({ todo_count: 1 }), { type: "with-todos" })).toBe(true);
    expect(matchesFilter(makeNode({ todo_count: 0 }), { type: "with-todos" })).toBe(false);
  });

  it("matches empty nodes (no collections, no todos)", () => {
    expect(matchesFilter(makeNode(), { type: "empty" })).toBe(true);
    expect(matchesFilter(makeNode({ collection_count: 1 }), { type: "empty" })).toBe(false);
    expect(matchesFilter(makeNode({ todo_count: 1 }), { type: "empty" })).toBe(false);
  });

  it("matches archive nodes (modified year ≤ ARCHIVE_YEAR_CEILING)", () => {
    expect(matchesFilter(makeNode({ modified: DATE_2022 }), { type: "archive" })).toBe(true);
    expect(matchesFilter(makeNode({ modified: DATE_2019 }), { type: "archive" })).toBe(true);
    expect(matchesFilter(makeNode({ modified: DATE_2023 }), { type: "archive" })).toBe(false);
  });

  it("matches only the exact year for 'year' filters", () => {
    const node = makeNode({ modified: DATE_2024 });
    expect(matchesFilter(node, { type: "year", year: 2024 })).toBe(true);
    expect(matchesFilter(node, { type: "year", year: 2025 })).toBe(false);
  });
});

describe("filtersEqual", () => {
  it("returns true for two filters of the same simple type", () => {
    expect(filtersEqual({ type: "all" }, { type: "all" })).toBe(true);
    expect(filtersEqual({ type: "pinned" }, { type: "pinned" })).toBe(true);
  });

  it("returns false for two different simple types", () => {
    expect(filtersEqual({ type: "all" }, { type: "pinned" })).toBe(false);
  });

  it("compares the year for 'year' filters", () => {
    expect(filtersEqual({ type: "year", year: 2024 }, { type: "year", year: 2024 })).toBe(true);
    expect(filtersEqual({ type: "year", year: 2024 }, { type: "year", year: 2025 })).toBe(false);
  });
});
