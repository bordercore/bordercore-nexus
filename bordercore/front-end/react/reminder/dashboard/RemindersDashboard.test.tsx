import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import RemindersDashboard from "./RemindersDashboard";
import type { Reminder } from "../types";

const FIXED_NOW = new Date("2026-05-04T12:00:00.000Z");
const FIXED_NOW_UNIX = Math.floor(FIXED_NOW.getTime() / 1000);

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
      "next_trigger_at_unix" in overrides
        ? overrides.next_trigger_at_unix!
        : FIXED_NOW_UNIX + 30 * 60,
    detail_url: overrides.detail_url ?? "/reminder/u-default/",
    update_url: overrides.update_url ?? "/reminder/u-default/edit/",
    delete_url: overrides.delete_url ?? "/reminder/u-default/delete/",
    form_ajax_url: overrides.form_ajax_url ?? "/reminder/ajax/form/u-default/",
  };
}

describe("RemindersDashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the page head, toolbar, and rail without crashing on empty data", () => {
    render(
      <RemindersDashboard reminders={[]} onNew={() => {}} onEdit={() => {}} onDelete={() => {}} />
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/filter reminders/i)).toBeInTheDocument();
    expect(screen.getByText(/no reminders to show/i)).toBeInTheDocument();
    expect(screen.getByText(/⌁ next trigger/i)).toBeInTheDocument();
    expect(screen.getByText(/^up next$/i)).toBeInTheDocument();
  });

  it("groups reminders into firing-soon, today-tomorrow, this-week, later, inactive", () => {
    const reminders: Reminder[] = [
      makeReminder({
        uuid: "1",
        name: "Imminent",
        next_trigger_at_unix: FIXED_NOW_UNIX + 30 * 60,
      }),
      makeReminder({
        uuid: "2",
        name: "Tomorrow",
        next_trigger_at_unix: FIXED_NOW_UNIX + 30 * 3600,
      }),
      makeReminder({
        uuid: "3",
        name: "Next Tuesday",
        next_trigger_at_unix: FIXED_NOW_UNIX + 5 * 86400,
      }),
      makeReminder({
        uuid: "4",
        name: "Far Out",
        next_trigger_at_unix: FIXED_NOW_UNIX + 30 * 86400,
      }),
      makeReminder({
        uuid: "5",
        name: "Inactive One",
        is_active: false,
      }),
    ];

    render(
      <RemindersDashboard
        reminders={reminders}
        onNew={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );

    const list = screen.getByRole("region", { name: /⌁ firing soon/i });
    expect(list).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /today & tomorrow/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /this week/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /^later$/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /^inactive$/i })).toBeInTheDocument();
    // The imminent reminder appears in both the list row and the nextup card.
    expect(screen.getAllByText("Imminent").length).toBeGreaterThan(0);
    expect(screen.getByText("Inactive One")).toBeInTheDocument();
  });

  it("shows the imminent reminder name in the next-trigger card", () => {
    const reminders: Reminder[] = [
      makeReminder({
        uuid: "1",
        name: "Drink Water",
        next_trigger_at_unix: FIXED_NOW_UNIX + 30 * 60,
      }),
    ];
    render(
      <RemindersDashboard
        reminders={reminders}
        onNew={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );
    const card = screen.getByText(/⌁ next trigger/i).closest("article");
    expect(card).not.toBeNull();
    expect(within(card!).getByText("Drink Water")).toBeInTheDocument();
  });

  it("filters via the active pill", () => {
    const reminders: Reminder[] = [
      makeReminder({
        uuid: "1",
        name: "Active One",
        next_trigger_at_unix: FIXED_NOW_UNIX + 60 * 60,
      }),
      makeReminder({
        uuid: "2",
        name: "Disabled One",
        is_active: false,
      }),
    ];

    render(
      <RemindersDashboard
        reminders={reminders}
        onNew={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );

    const list = screen.getByRole("region", { name: /firing soon/i }).parentElement!;

    expect(within(list).getByText("Active One")).toBeInTheDocument();
    expect(screen.getByText("Disabled One")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    const activePill = buttons.find(b =>
      b.textContent?.replace(/\s+/g, " ").trim().startsWith("active")
    );
    expect(activePill).toBeDefined();
    fireEvent.click(activePill!);
    expect(within(list).getByText("Active One")).toBeInTheDocument();
    expect(screen.queryByText("Disabled One")).toBeNull();
  });

  it("invokes onNew when the New button is clicked", () => {
    const onNew = vi.fn();
    render(
      <RemindersDashboard reminders={[]} onNew={onNew} onEdit={() => {}} onDelete={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: /^new$/i }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("invokes onEdit and onDelete from the row action buttons", () => {
    const reminder = makeReminder({
      uuid: "1",
      name: "Tap me",
      next_trigger_at_unix: FIXED_NOW_UNIX + 60 * 60,
    });
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <RemindersDashboard
        reminders={[reminder]}
        onNew={() => {}}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByLabelText(/edit tap me/i));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0][0].uuid).toBe("1");

    fireEvent.click(screen.getByLabelText(/delete tap me/i));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0][0].uuid).toBe("1");
  });
});
