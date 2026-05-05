import { describe, expect, it } from "vitest";

import { formatIssueDate, greetingForHour } from "./utils";

describe("formatIssueDate", () => {
  it("returns the local hour as a 24-hour number", () => {
    // 3 PM local time
    const afternoon = new Date(2026, 4, 5, 15, 30);
    expect(formatIssueDate(afternoon).hour).toBe(15);
  });

  it("returns hour 0 for midnight", () => {
    const midnight = new Date(2026, 4, 5, 0, 0);
    expect(formatIssueDate(midnight).hour).toBe(0);
  });

  it("returns hour 23 for 11 PM", () => {
    const lateNight = new Date(2026, 4, 5, 23, 0);
    expect(formatIssueDate(lateNight).hour).toBe(23);
  });
});

describe("greetingForHour", () => {
  it("greets morning before noon", () => {
    expect(greetingForHour(0)).toBe("Good Morning,");
    expect(greetingForHour(8)).toBe("Good Morning,");
    expect(greetingForHour(11)).toBe("Good Morning,");
  });

  it("greets afternoon between noon and 6 PM", () => {
    expect(greetingForHour(12)).toBe("Good Afternoon,");
    expect(greetingForHour(15)).toBe("Good Afternoon,");
    expect(greetingForHour(17)).toBe("Good Afternoon,");
  });

  it("greets evening from 6 PM onward", () => {
    expect(greetingForHour(18)).toBe("Good Evening,");
    expect(greetingForHour(23)).toBe("Good Evening,");
  });

  // Regression: formerly the hour was parsed back out of a 12-hour locale
  // string ("3:45 PM" → 3 → "Good Morning"). Lock in 24-hour input.
  it("treats hours 13-17 as afternoon (not morning)", () => {
    for (let h = 13; h <= 17; h += 1) {
      expect(greetingForHour(h)).toBe("Good Afternoon,");
    }
  });
});
