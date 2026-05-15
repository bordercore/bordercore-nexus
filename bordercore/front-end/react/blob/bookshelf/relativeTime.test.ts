import { describe, expect, it } from "vitest";

import { relativeTime } from "./relativeTime";

const NOW = new Date("2026-05-15T12:00:00.000Z");
const ago = (s: number) => new Date(NOW.getTime() - s * 1000).toISOString();

describe("relativeTime — input handling", () => {
  it("returns '' for null, undefined, and empty input", () => {
    expect(relativeTime(null, NOW)).toBe("");
    expect(relativeTime(undefined, NOW)).toBe("");
    expect(relativeTime("", NOW)).toBe("");
  });

  it("returns '' for an unparseable date", () => {
    expect(relativeTime("not-a-date", NOW)).toBe("");
  });

  it("returns 'just now' for sub-60s deltas, including future timestamps", () => {
    expect(relativeTime(ago(0), NOW)).toBe("just now");
    expect(relativeTime(ago(30), NOW)).toBe("just now");
    expect(relativeTime(ago(59), NOW)).toBe("just now");
    expect(relativeTime(new Date(NOW.getTime() + 5_000).toISOString(), NOW)).toBe("just now");
  });
});

describe("relativeTime — minutes", () => {
  it("formats 60s as '1 minute ago'", () => {
    expect(relativeTime(ago(60), NOW)).toBe("1 minute ago");
  });

  it("pluralizes minutes", () => {
    expect(relativeTime(ago(5 * 60), NOW)).toBe("5 minutes ago");
    expect(relativeTime(ago(59 * 60), NOW)).toBe("59 minutes ago");
  });
});

describe("relativeTime — hours", () => {
  it("formats 1h as '1 hour ago'", () => {
    expect(relativeTime(ago(60 * 60), NOW)).toBe("1 hour ago");
  });

  it("pluralizes hours", () => {
    expect(relativeTime(ago(3 * 60 * 60), NOW)).toBe("3 hours ago");
    expect(relativeTime(ago(23 * 60 * 60), NOW)).toBe("23 hours ago");
  });
});

describe("relativeTime — days", () => {
  it("formats 1d as '1 day ago'", () => {
    expect(relativeTime(ago(24 * 60 * 60), NOW)).toBe("1 day ago");
  });

  it("pluralizes days", () => {
    expect(relativeTime(ago(2 * 24 * 60 * 60), NOW)).toBe("2 days ago");
    expect(relativeTime(ago(6 * 24 * 60 * 60), NOW)).toBe("6 days ago");
  });
});

describe("relativeTime — weeks", () => {
  it("formats 1w as '1 week ago'", () => {
    expect(relativeTime(ago(7 * 24 * 60 * 60), NOW)).toBe("1 week ago");
  });

  it("pluralizes weeks", () => {
    expect(relativeTime(ago(3 * 7 * 24 * 60 * 60), NOW)).toBe("3 weeks ago");
  });
});

describe("relativeTime — months and years", () => {
  it("formats ~31 days as '1 month ago'", () => {
    expect(relativeTime(ago(31 * 24 * 60 * 60), NOW)).toBe("1 month ago");
  });

  it("formats 6 months as '6 months ago'", () => {
    expect(relativeTime(ago(183 * 24 * 60 * 60), NOW)).toBe("6 months ago");
  });

  it("formats 2 years as '2 years ago'", () => {
    expect(relativeTime(ago(2 * 365 * 24 * 60 * 60), NOW)).toBe("2 years ago");
  });

  it("uses 'year' as the terminal bucket for very long deltas", () => {
    expect(relativeTime(ago(20 * 365 * 24 * 60 * 60), NOW)).toMatch(/years ago$/);
  });
});
