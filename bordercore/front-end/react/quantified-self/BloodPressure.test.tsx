import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BloodPressure, { category } from "./BloodPressure";
import { api } from "./api";
import { Reading } from "./types";

vi.mock("./api", async importOriginal => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: vi.fn(),
  today: () => "2026-10-22",
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.useRealTimers();
});

function reading(overrides: Partial<Reading>): Reading {
  return {
    uuid: Math.random().toString(36).slice(2),
    source: "Omron",
    external_id: "",
    note: "",
    excluded: false,
    date: "2026-10-03",
    time: "07:42:00",
    timezone: "America/New_York",
    systolic: 106,
    diastolic: 69,
    pulse: 58,
    ...overrides,
  };
}

const rows = [
  reading({ uuid: "latest" }),
  reading({
    uuid: "walk",
    date: "2026-09-28",
    time: "22:10:00",
    source: "Apple Health",
    systolic: 114,
    diastolic: 73,
    pulse: 64,
    note: "evening, after walk",
  }),
  reading({
    uuid: "high",
    date: "2026-09-02",
    time: "08:03:00",
    source: "Manual",
    systolic: 131,
    diastolic: 84,
    pulse: 72,
    note: "after travel, poor sleep",
  }),
  reading({
    uuid: "same-day",
    date: "2026-09-02",
    time: "19:00:00",
    systolic: 129,
    diastolic: 76,
    pulse: null,
  }),
  reading({
    uuid: "cuff",
    date: "2026-08-30",
    time: "07:51:00",
    source: "Apple Health",
    systolic: 188,
    diastolic: 41,
    pulse: null,
    note: "cuff error",
    excluded: true,
  }),
];

function setup(results: Reading[] = rows) {
  vi.mocked(api).mockResolvedValue({ count: results.length, results });
  const props = {
    root: "/quantified-self/",
    start: "2026-07-25",
    end: "2026-10-22",
    revision: 0,
    onRange: vi.fn(),
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onChanged: vi.fn(),
  };
  render(<BloodPressure {...props} />);
  return props;
}

it("classifies single readings with the higher category winning", () => {
  expect(category(119, 79)).toBe("normal");
  expect(category(125, 79)).toBe("elevated");
  expect(category(118, 82)).toBe("stage 1");
  expect(category(135, 70)).toBe("stage 1");
  expect(category(125, 92)).toBe("stage 2");
  expect(category(141, 70)).toBe("stage 2");
});

it("summarizes included readings and leaves excluded ones out", async () => {
  setup();
  const table = await screen.findByRole("table", { name: "Blood pressure readings" });
  expect(api).toHaveBeenCalledWith(
    "/quantified-self/blood-pressure/records/?start=2026-07-25&end=2026-10-22&limit=20000"
  );
  expect(screen.getByText("4 readings", { selector: "b" })).toBeInTheDocument();
  const latest = screen.getByText("latest").parentElement!;
  expect(latest).toHaveTextContent("106/69");
  expect(latest).toHaveTextContent("10-03 07:42 · pulse 58");
  // Mean of daily means: (106 + 114 + 130) / 3 and (69 + 73 + 80) / 3.
  const rangeMean = screen.getByText("range mean").parentElement!;
  expect(rangeMean).toHaveTextContent("117/74");
  expect(rangeMean).toHaveTextContent("of daily means · 3 days");
  expect(screen.getByText("systolic span").parentElement!).toHaveTextContent("106–131");
  expect(screen.getByText("systolic span").parentElement!).toHaveTextContent("1 reading ≥ 130");
  expect(screen.getByText("pulse", { selector: ".qs-kpi-label" }).parentElement!).toHaveTextContent(
    "3 of 4 readings"
  );
  expect(within(table).queryByText("2026-08-30")).toBeNull();
  expect(within(table).getAllByText("stage 1")).toHaveLength(1);
  expect(screen.getByText("showing 4 of 4 · 1 excluded")).toBeInTheDocument();
});

it("shows excluded rows on request and restores them", async () => {
  const props = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "○ show excluded" }));
  expect(screen.getByText("excluded · cuff error")).toBeInTheDocument();
  vi.mocked(api).mockResolvedValueOnce({});
  await user.click(screen.getByRole("button", { name: "restore" }));
  expect(api).toHaveBeenCalledWith("/quantified-self/blood-pressure/records/cuff/", "PATCH", {
    excluded: false,
  });
  expect(screen.queryByText("excluded · cuff error")).toBeNull();
  await waitFor(() => expect(props.onChanged).toHaveBeenCalled());
  expect(screen.getByText("5 readings", { selector: "b" })).toBeInTheDocument();
});

it("confirms, then optimistically deletes, restoring the row on failure", async () => {
  setup();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Delete reading 2026-09-28 22:10:00" })
  );
  expect(screen.getByText("delete this reading? · cannot be undone")).toBeInTheDocument();
  vi.mocked(api).mockRejectedValueOnce(new Error("Network down"));
  await user.click(screen.getByRole("button", { name: "delete" }));
  expect(api).toHaveBeenCalledWith("/quantified-self/blood-pressure/records/walk/", "DELETE");
  expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
  expect(screen.getByText("evening, after walk")).toBeInTheDocument();
});

it("filters by note search, source and selected chart day", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  setup();
  const table = await screen.findByRole("table", { name: "Blood pressure readings" });
  fireEvent.change(screen.getByRole("searchbox", { name: "Search notes" }), {
    target: { value: "TRAVEL" },
  });
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search notes" }), {
    target: { value: "" },
  });
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Source" }), {
    target: { value: "Apple Health" },
  });
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(screen.getByRole("link", { name: "export csv" })).toHaveAttribute(
    "href",
    "/quantified-self/blood-pressure/export/?start=2026-07-25&end=2026-10-22&source=Apple%20Health"
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Source" }), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: /^2026-09-02: 130\/80 mmHg/ }));
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Clear day filter 2026-09-02" }));
  expect(within(table).getAllByRole("row")).toHaveLength(5);
});

it("sorts by a column header and paginates by twenty", async () => {
  const many = Array.from({ length: 25 }, (_, i) =>
    reading({ uuid: `r${i}`, date: `2026-09-${String(i + 1).padStart(2, "0")}`, systolic: 100 + i })
  );
  setup(many);
  const user = userEvent.setup();
  const table = await screen.findByRole("table", { name: "Blood pressure readings" });
  expect(screen.getByText("showing 20 of 25")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "systolic" }));
  expect(within(table).getAllByRole("row")[1]).toHaveTextContent("2026-09-01");
  await user.click(screen.getByRole("button", { name: /^systolic/ }));
  expect(within(table).getAllByRole("row")[1]).toHaveTextContent("2026-09-25");
  await user.click(screen.getByRole("button", { name: "load 5 more ↓" }));
  expect(screen.getByText("showing 25 of 25")).toBeInTheDocument();
});

it("renders an empty range without failing", async () => {
  setup([]);
  expect(await screen.findByText("No readings match your filter.")).toBeInTheDocument();
  expect(screen.getByText("no readings in this range")).toBeInTheDocument();
  expect(screen.getByText("latest").parentElement!).toHaveTextContent("—");
});

it("changes ranges from today and opens the editor", async () => {
  const props = setup();
  const user = userEvent.setup();
  await screen.findByRole("table", { name: "Blood pressure readings" });
  expect(screen.getByRole("button", { name: "90d" })).toHaveAttribute("aria-pressed", "true");
  await user.click(screen.getByRole("button", { name: "30d" }));
  expect(props.onRange).toHaveBeenCalledWith("2026-09-23", "2026-10-22");
  await user.click(screen.getByRole("button", { name: "reading" }));
  expect(props.onAdd).toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Edit reading 2026-10-03 07:42:00" }));
  expect(props.onEdit).toHaveBeenCalledWith(rows[0]);
});

it("keeps the layout without loading or empty messages while the first load is pending", () => {
  vi.mocked(api).mockReturnValue(new Promise(() => {}) as ReturnType<typeof api>);
  render(
    <BloodPressure
      root="/quantified-self/"
      start="2026-07-25"
      end="2026-10-22"
      revision={0}
      onRange={vi.fn()}
      onAdd={vi.fn()}
      onEdit={vi.fn()}
      onChanged={vi.fn()}
    />
  );
  expect(screen.getByRole("table", { name: "Blood pressure readings" })).toHaveAttribute(
    "aria-busy",
    "true"
  );
  expect(screen.queryByText(/Loading/)).toBeNull();
  expect(screen.queryByText("No readings match your filter.")).toBeNull();
  expect(screen.queryByText("no readings in this range")).toBeNull();
});

it("picks a custom range and ignores reversed dates", async () => {
  const props = setup();
  await screen.findByRole("table", { name: "Blood pressure readings" });
  await userEvent.setup().click(screen.getByRole("button", { name: "custom…" }));
  expect(screen.getByRole("button", { name: "90d" })).toHaveAttribute("aria-pressed", "false");
  fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-08-01" } });
  expect(props.onRange).toHaveBeenCalledWith("2026-08-01", "2026-10-22");
  props.onRange.mockClear();
  fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-07-01" } });
  expect(props.onRange).not.toHaveBeenCalled();
});
