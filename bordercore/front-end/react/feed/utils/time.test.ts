import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatRelativeShort } from "./time";

const FIXED_NOW = new Date("2026-05-15T12:00:00.000Z");

describe("formatRelativeShort", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns '' for null, undefined, and empty input", () => {
    expect(formatRelativeShort(null)).toBe("");
    expect(formatRelativeShort(undefined)).toBe("");
    expect(formatRelativeShort("")).toBe("");
  });

  it("returns '' for an unparseable date", () => {
    expect(formatRelativeShort("not-a-date")).toBe("");
  });

  it("formats sub-hour deltas in minutes, floor 1m", () => {
    const thirtySecondsAgo = new Date(FIXED_NOW.getTime() - 30_000).toISOString();
    expect(formatRelativeShort(thirtySecondsAgo)).toBe("1m");

    const fiveMinAgo = new Date(FIXED_NOW.getTime() - 5 * 60_000).toISOString();
    expect(formatRelativeShort(fiveMinAgo)).toBe("5m");
  });

  it("formats deltas between 1h and 24h in hours", () => {
    const threeHoursAgo = new Date(FIXED_NOW.getTime() - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeShort(threeHoursAgo)).toBe("3h");
  });

  it("formats deltas between 1d and 1w in days", () => {
    const twoDaysAgo = new Date(FIXED_NOW.getTime() - 2 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeShort(twoDaysAgo)).toBe("2d");
  });

  it("formats deltas of a week or more in weeks", () => {
    const threeWeeksAgo = new Date(FIXED_NOW.getTime() - 3 * 7 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeShort(threeWeeksAgo)).toBe("3w");
  });
});
