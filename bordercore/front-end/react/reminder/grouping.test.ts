import { describe, expect, it } from "vitest";
import {
  applyFilter,
  bucketReminders,
  classifyGroup,
  countByFilter,
  countdownProgress,
  deriveImminent,
  deriveNextActive,
  deriveStats,
  deriveUpNext,
  formatCountdown,
  isImminent,
} from "./grouping";
import type { Reminder } from "./types";

const NOW = new Date("2026-05-04T12:00:00.000Z");
const NOW_UNIX = Math.floor(NOW.getTime() / 1000);

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    uuid: overrides.uuid ?? "u-default",
    name: overrides.name ?? "Reminder",
    note: overrides.note ?? "",
    is_active: overrides.is_active ?? true,
    schedule_type: overrides.schedule_type ?? "daily",
    schedule_description: overrides.schedule_description ?? "Daily at 9:00 AM",
    days_of_week: overrides.days_of_week ?? [],
    days_of_month: overrides.days_of_month ?? [],
    interval_value: overrides.interval_value ?? 1,
    interval_unit_display: overrides.interval_unit_display ?? "day",
    next_trigger_at: overrides.next_trigger_at ?? "May 04, 12:30 PM",
    next_trigger_at_unix:
      "next_trigger_at_unix" in overrides ? overrides.next_trigger_at_unix! : NOW_UNIX + 30 * 60,
    detail_url: overrides.detail_url ?? "/reminder/u-default/",
    update_url: overrides.update_url ?? "/reminder/u-default/edit/",
    delete_url: overrides.delete_url ?? "/reminder/u-default/delete/",
    form_ajax_url: overrides.form_ajax_url ?? "/reminder/ajax/form/u-default/",
  };
}

describe("classifyGroup", () => {
  it("buckets active reminders by next-trigger delta", () => {
    const cases: [number, ReturnType<typeof classifyGroup>][] = [
      [-60, "firing-soon"],
      [10 * 60, "firing-soon"],
      [60 * 60, "firing-soon"],
      [60 * 60 + 1, "today-tomorrow"],
      [40 * 3600, "today-tomorrow"],
      [48 * 3600, "today-tomorrow"],
      [49 * 3600, "this-week"],
      [6 * 86400, "this-week"],
      [7 * 86400, "this-week"],
      [8 * 86400, "later"],
    ];
    for (const [seconds, expected] of cases) {
      const r = makeReminder({ next_trigger_at_unix: NOW_UNIX + seconds });
      expect(classifyGroup(r, NOW)).toBe(expected);
    }
  });

  it("treats null next_trigger_at as later for active", () => {
    const r = makeReminder({ next_trigger_at_unix: null, next_trigger_at: null });
    expect(classifyGroup(r, NOW)).toBe("later");
  });

  it("treats inactive reminders as inactive regardless of timing", () => {
    const r = makeReminder({
      is_active: false,
      next_trigger_at_unix: NOW_UNIX + 60,
    });
    expect(classifyGroup(r, NOW)).toBe("inactive");
  });
});

describe("bucketReminders", () => {
  it("returns groups in canonical order, skipping empty groups", () => {
    const reminders = [
      makeReminder({ uuid: "1", next_trigger_at_unix: NOW_UNIX + 10 * 60 }),
      makeReminder({ uuid: "2", next_trigger_at_unix: NOW_UNIX + 30 * 3600 }),
      makeReminder({ uuid: "3", is_active: false }),
    ];
    const groups = bucketReminders(reminders, NOW);
    expect(groups.map(g => g.key)).toEqual(["firing-soon", "today-tomorrow", "inactive"]);
    expect(groups[0].reminders.map(r => r.uuid)).toEqual(["1"]);
    expect(groups[2].reminders.map(r => r.uuid)).toEqual(["3"]);
  });

  it("returns empty list when there are no reminders", () => {
    expect(bucketReminders([], NOW)).toEqual([]);
  });
});

describe("deriveImminent", () => {
  it("returns the first firing-soon reminder", () => {
    const reminders = [
      makeReminder({ uuid: "1", next_trigger_at_unix: NOW_UNIX + 5 * 3600 }),
      makeReminder({ uuid: "2", next_trigger_at_unix: NOW_UNIX + 5 * 60 }),
      makeReminder({ uuid: "3", next_trigger_at_unix: NOW_UNIX + 30 * 60 }),
    ];
    expect(deriveImminent(reminders, NOW)?.uuid).toBe("2");
  });

  it("returns null when no reminder is firing soon", () => {
    const reminders = [makeReminder({ uuid: "1", next_trigger_at_unix: NOW_UNIX + 5 * 3600 })];
    expect(deriveImminent(reminders, NOW)).toBeNull();
  });
});

describe("deriveNextActive", () => {
  it("returns the first active reminder with a scheduled trigger", () => {
    const reminders = [
      makeReminder({
        uuid: "1",
        is_active: false,
        next_trigger_at_unix: NOW_UNIX + 60,
      }),
      makeReminder({
        uuid: "2",
        next_trigger_at_unix: null,
        next_trigger_at: null,
      }),
      makeReminder({ uuid: "3", next_trigger_at_unix: NOW_UNIX + 5 * 3600 }),
    ];
    expect(deriveNextActive(reminders, NOW)?.uuid).toBe("3");
  });

  it("returns null when no active reminders have a trigger", () => {
    expect(deriveNextActive([], NOW)).toBeNull();
  });
});

describe("deriveUpNext", () => {
  it("returns up to limit active reminders, excluding the imminent one", () => {
    const reminders = [
      makeReminder({ uuid: "1", next_trigger_at_unix: NOW_UNIX + 10 * 60 }),
      makeReminder({ uuid: "2", next_trigger_at_unix: NOW_UNIX + 60 * 60 }),
      makeReminder({ uuid: "3", next_trigger_at_unix: NOW_UNIX + 2 * 3600 }),
      makeReminder({ uuid: "4", next_trigger_at_unix: NOW_UNIX + 3 * 3600 }),
      makeReminder({
        uuid: "5",
        is_active: false,
        next_trigger_at_unix: NOW_UNIX + 4 * 3600,
      }),
    ];
    const upNext = deriveUpNext(reminders, NOW, "1");
    expect(upNext.map(r => r.uuid)).toEqual(["2", "3", "4"]);
  });

  it("respects a custom limit", () => {
    const reminders = [
      makeReminder({ uuid: "1", next_trigger_at_unix: NOW_UNIX + 10 * 60 }),
      makeReminder({ uuid: "2", next_trigger_at_unix: NOW_UNIX + 60 * 60 }),
    ];
    expect(deriveUpNext(reminders, NOW, null, 1).map(r => r.uuid)).toEqual(["1"]);
  });
});

describe("deriveStats", () => {
  it("counts active, today, and next-7d", () => {
    const inOneHour = NOW_UNIX + 60 * 60;
    const tomorrowSameTime = NOW_UNIX + 24 * 3600;
    const inThreeDays = NOW_UNIX + 3 * 86400;
    const inTwoWeeks = NOW_UNIX + 14 * 86400;

    const reminders = [
      makeReminder({ uuid: "1", next_trigger_at_unix: inOneHour }),
      makeReminder({ uuid: "2", next_trigger_at_unix: tomorrowSameTime }),
      makeReminder({ uuid: "3", next_trigger_at_unix: inThreeDays }),
      makeReminder({ uuid: "4", next_trigger_at_unix: inTwoWeeks }),
      makeReminder({
        uuid: "5",
        is_active: false,
        next_trigger_at_unix: inOneHour,
      }),
    ];
    expect(deriveStats(reminders, NOW)).toEqual({
      active: 4,
      today: 1,
      next_7d: 3,
    });
  });

  it("returns zeros for an empty list", () => {
    expect(deriveStats([], NOW)).toEqual({ active: 0, today: 0, next_7d: 0 });
  });
});

describe("applyFilter", () => {
  const reminders = [
    makeReminder({
      uuid: "1",
      name: "Water plants",
      note: "outside only",
      next_trigger_at_unix: NOW_UNIX + 60 * 60,
    }),
    makeReminder({
      uuid: "2",
      name: "Pay rent",
      note: "",
      is_active: false,
      next_trigger_at_unix: NOW_UNIX + 60 * 60,
    }),
    makeReminder({
      uuid: "3",
      name: "Read",
      note: "",
      next_trigger_at_unix: NOW_UNIX + 8 * 86400,
    }),
  ];

  it("filter=all returns everything matching the query", () => {
    expect(applyFilter(reminders, "all", "", NOW).map(r => r.uuid)).toEqual(["1", "2", "3"]);
    expect(applyFilter(reminders, "all", "rent", NOW).map(r => r.uuid)).toEqual(["2"]);
  });

  it("filter=active excludes inactive", () => {
    expect(applyFilter(reminders, "active", "", NOW).map(r => r.uuid)).toEqual(["1", "3"]);
  });

  it("filter=today returns only active reminders firing today", () => {
    expect(applyFilter(reminders, "today", "", NOW).map(r => r.uuid)).toEqual(["1"]);
  });

  it("query matches name or note, case-insensitive", () => {
    expect(applyFilter(reminders, "all", "OUTSIDE", NOW).map(r => r.uuid)).toEqual(["1"]);
  });
});

describe("countByFilter", () => {
  it("returns counts independent of the active query", () => {
    const reminders = [
      makeReminder({ uuid: "1", next_trigger_at_unix: NOW_UNIX + 60 * 60 }),
      makeReminder({
        uuid: "2",
        is_active: false,
        next_trigger_at_unix: NOW_UNIX + 60 * 60,
      }),
      makeReminder({ uuid: "3", next_trigger_at_unix: NOW_UNIX + 8 * 86400 }),
    ];
    expect(countByFilter(reminders, NOW)).toEqual({
      all: 3,
      active: 2,
      today: 1,
    });
  });
});

describe("isImminent", () => {
  it("is true only for firing-soon active reminders", () => {
    expect(isImminent(makeReminder({ next_trigger_at_unix: NOW_UNIX + 30 * 60 }), NOW)).toBe(true);
    expect(isImminent(makeReminder({ next_trigger_at_unix: NOW_UNIX + 5 * 3600 }), NOW)).toBe(
      false
    );
    expect(
      isImminent(
        makeReminder({
          is_active: false,
          next_trigger_at_unix: NOW_UNIX + 30 * 60,
        }),
        NOW
      )
    ).toBe(false);
  });
});

describe("formatCountdown", () => {
  it("formats positive deltas with leading zeros", () => {
    const out = formatCountdown((61 * 60 + 5) * 1000);
    expect(out).toEqual({ hh: "01", mm: "01", ss: "05", total_seconds: 3665 });
  });

  it("clamps negative deltas to zero", () => {
    expect(formatCountdown(-5_000)).toEqual({
      hh: "00",
      mm: "00",
      ss: "00",
      total_seconds: 0,
    });
  });
});

describe("countdownProgress", () => {
  it("is 1 at fire time, 0 at 24h out", () => {
    expect(countdownProgress(0)).toBe(1);
    expect(countdownProgress(24 * 3600 * 1000)).toBe(0);
    expect(countdownProgress(12 * 3600 * 1000)).toBe(0.5);
  });

  it("is 1 for past deltas and 0 for very large deltas", () => {
    expect(countdownProgress(-1_000)).toBe(1);
    expect(countdownProgress(48 * 3600 * 1000)).toBe(0);
  });
});
