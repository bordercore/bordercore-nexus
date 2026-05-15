import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addDays,
  daysBetween,
  eyebrowDate,
  greetingForHour,
  mastheadDate,
  parseIsoDate,
  shortDate,
  timeAgo,
  toIsoDate,
  todayIso,
} from "./format";

describe("parseIsoDate / toIsoDate round-trip", () => {
  it("round-trips an ISO date through local midnight", () => {
    expect(toIsoDate(parseIsoDate("2026-05-15"))).toBe("2026-05-15");
    expect(toIsoDate(parseIsoDate("2024-01-01"))).toBe("2024-01-01");
    expect(toIsoDate(parseIsoDate("2024-12-31"))).toBe("2024-12-31");
  });

  it("toIsoDate pads month and day", () => {
    // Local-time constructor: month is 0-indexed.
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toIsoDate(new Date(2026, 8, 9))).toBe("2026-09-09");
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    expect(addDays("2026-05-15", 1)).toBe("2026-05-16");
    expect(addDays("2026-05-15", 10)).toBe("2026-05-25");
  });

  it("adds negative days", () => {
    expect(addDays("2026-05-15", -1)).toBe("2026-05-14");
  });

  it("rolls over month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("returns the same date for +0", () => {
    expect(addDays("2026-05-15", 0)).toBe("2026-05-15");
  });
});

describe("shortDate / eyebrowDate / mastheadDate", () => {
  // 2026-05-15 is a Friday on the Gregorian calendar regardless of TZ.
  it("shortDate formats as 'Weekday, Mon D'", () => {
    expect(shortDate("2026-05-15")).toBe("Fri, May 15");
    expect(shortDate("2026-01-01")).toBe("Thu, Jan 1");
  });

  it("eyebrowDate uppercases the weekday and month", () => {
    expect(eyebrowDate("2026-05-15")).toBe("FRI, MAY 15");
  });

  it("mastheadDate spells out the weekday", () => {
    expect(mastheadDate("2026-05-15")).toBe("Friday, May 15");
    expect(mastheadDate("2026-01-04")).toBe("Sunday, Jan 4");
  });
});

describe("greetingForHour", () => {
  it.each([
    [0, "Good morning"],
    [5, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [17, "Good afternoon"],
    [18, "Good evening"],
    [23, "Good evening"],
  ])("returns the right greeting for hour %i", (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});

describe("timeAgo", () => {
  beforeEach(() => {
    // Local noon on 2026-05-15 — parseIsoDate("2026-05-15") is local midnight,
    // so the delta is 12h regardless of host timezone.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'today' for the same date", () => {
    expect(timeAgo("2026-05-15")).toBe("today");
  });

  it("returns '1 day ago' for yesterday", () => {
    expect(timeAgo("2026-05-14")).toBe("1 day ago");
  });

  it("returns days for the first two weeks", () => {
    expect(timeAgo("2026-05-03")).toBe("12 days ago");
  });

  it("switches to weeks after 14 days", () => {
    expect(timeAgo("2026-04-15")).toMatch(/weeks ago$/);
  });

  it("switches to months after ~9 weeks", () => {
    expect(timeAgo("2026-01-15")).toMatch(/months ago$/);
  });

  it("uses 'yr' / 'mo' for multi-year spans", () => {
    expect(timeAgo("2023-02-15")).toMatch(/^\d+ yr( \d+ mo)?$/);
  });
});

describe("todayIso", () => {
  it("returns the current local date in YYYY-MM-DD form", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15, 9, 0, 0));
    expect(todayIso()).toBe("2026-05-15");
    vi.useRealTimers();
  });
});

describe("daysBetween", () => {
  it("returns 0 for the same date", () => {
    expect(daysBetween("2026-05-15", "2026-05-15")).toBe(0);
  });

  it("returns a positive count for to > from", () => {
    expect(daysBetween("2026-05-15", "2026-05-20")).toBe(5);
  });

  it("returns a negative count for to < from", () => {
    expect(daysBetween("2026-05-20", "2026-05-15")).toBe(-5);
  });

  it("counts across month boundaries", () => {
    expect(daysBetween("2026-01-30", "2026-02-02")).toBe(3);
  });
});
