import { act, render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import RemindersBell from "./RemindersBell";

// Capture the onMessage callback the component registers, so tests can
// drive the component as if a websocket frame arrived.
let capturedOnMessage: ((msg: unknown) => void) | null = null;

vi.mock("../common/hooks/useLiveChannel", () => ({
  useLiveChannel: (_path: string, onMessage: (msg: unknown) => void) => {
    capturedOnMessage = onMessage;
  },
}));

const baseReminder = {
  uuid: "9a3e0000-0000-0000-0000-000000000001",
  name: "Pay rent",
  note: "Use Zelle",
  fired_at: "2026-05-22T14:00:00-05:00",
};

function fire(reminder = baseReminder) {
  act(() => {
    capturedOnMessage?.({ type: "reminder.fired", reminder });
  });
}

describe("RemindersBell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    capturedOnMessage = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when no reminders have fired", () => {
    const { container } = render(<RemindersBell />);
    expect(container.firstChild).toBeNull();
  });

  it("shows a reminder name after a reminder.fired message", () => {
    render(<RemindersBell />);
    fire();
    expect(screen.getByText("1")).toBeInTheDocument();
    // Open the popover
    fireEvent.click(screen.getByRole("button", { name: /reminder/i }));
    expect(screen.getByText("Pay rent")).toBeInTheDocument();
    expect(screen.getByText("Use Zelle")).toBeInTheDocument();
  });

  it("dedups repeated fires of the same uuid", () => {
    render(<RemindersBell />);
    fire();
    fire({ ...baseReminder, name: "Pay rent (updated)" });
    // Still one entry, count badge shows 1
    expect(screen.getByText("1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reminder/i }));
    expect(screen.getByText("Pay rent (updated)")).toBeInTheDocument();
    expect(screen.queryByText("Pay rent")).not.toBeInTheDocument();
  });

  it("counts distinct uuids", () => {
    render(<RemindersBell />);
    fire();
    fire({ ...baseReminder, uuid: "9a3e0000-0000-0000-0000-000000000002", name: "Other" });
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("evicts a reminder after 1 hour", () => {
    const { container } = render(<RemindersBell />);
    fire();
    expect(screen.getByText("1")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });
    expect(container.firstChild).toBeNull();
  });

  it("clear-all empties state and unmounts the bell", () => {
    const { container } = render(<RemindersBell />);
    fire();
    fire({ ...baseReminder, uuid: "9a3e0000-0000-0000-0000-000000000002", name: "Other" });
    fireEvent.click(screen.getByRole("button", { name: /reminder/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(container.firstChild).toBeNull();
  });

  it("ignores malformed messages", () => {
    const { container } = render(<RemindersBell />);
    act(() => {
      capturedOnMessage?.({ type: "wrong" });
      capturedOnMessage?.(null);
      capturedOnMessage?.({ type: "reminder.fired" }); // missing reminder
    });
    expect(container.firstChild).toBeNull();
  });
});
