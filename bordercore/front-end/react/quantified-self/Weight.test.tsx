import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Weight, { dailyMeans, trendOn } from "./Weight";
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
});

const LB = 0.45359237;
function reading(date: string, lb: number, overrides: Partial<Reading> = {}): Reading {
  return {
    uuid: `${date}-${lb}`,
    source: "Withings",
    external_id: "",
    note: "",
    excluded: false,
    date,
    time: "06:58:00",
    timezone: "America/New_York",
    value: String(lb),
    unit: "lb",
    kilograms: lb * LB,
    ...overrides,
  };
}

// A steady loss of 0.1 lb/day from 170 lb on 2026-08-15 (before the 30-day
// range, so the 30-day comparison has history), plus an evening reading, an
// excluded glitch and a reading on a day with no other data.
const history = Array.from({ length: 69 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 7, 15 + i)).toISOString().slice(0, 10);
  return reading(date, Math.round((170 - i * 0.1) * 10) / 10);
});
const rows = [
  ...history,
  reading("2026-10-18", 165, {
    uuid: "evening",
    time: "21:40:00",
    source: "Manual",
    note: "evening",
  }),
  reading("2026-10-10", 184, {
    uuid: "glitch",
    source: "Apple Health",
    excluded: true,
    note: "scale glitch",
  }),
];

function setup(results: Reading[] = rows, unit: "lb" | "kg" = "lb") {
  vi.mocked(api).mockImplementation(
    url =>
      Promise.resolve(
        String(url).includes("/imports/")
          ? [
              {
                uuid: "batch",
                kind: "apple-health",
                source: "Apple Health",
                created_at: "2026-10-01T14:00:00+00:00",
                committed: true,
              },
            ]
          : { count: results.length, results }
      ) as ReturnType<typeof api>
  );
  const props = {
    root: "/quantified-self/",
    start: "2026-09-23",
    end: "2026-10-22",
    unit,
    revision: 0,
    onRange: vi.fn(),
    onUnit: vi.fn(),
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onChanged: vi.fn(),
  };
  render(<Weight {...props} />);
  return props;
}

it("averages the daily means of the last seven calendar days, skipping empty days", () => {
  const means = dailyMeans(
    [
      reading("2026-10-01", 160),
      reading("2026-10-01", 162),
      reading("2026-10-05", 158),
      reading("2026-09-20", 100),
    ].map(r => ({ ...r, kilograms: r.kilograms! })),
    "lb"
  );
  expect(means.get("2026-10-01")!.value).toBeCloseTo(161);
  expect(trendOn(means, "2026-10-07")!).toBeCloseTo((161 + 158) / 2);
  expect(trendOn(means, "2026-09-30")).toBeNull();
});

it("loads history before the range and fills the KPI strip", async () => {
  setup();
  await screen.findByRole("table", { name: "Weight readings" });
  expect(api).toHaveBeenCalledWith(
    "/quantified-self/weight/records/?start=2026-08-17&end=2026-10-22&limit=20000"
  );
  const tile = (label: string) =>
    screen.getByText(label, { selector: ".qs-kpi-label" }).parentElement!;
  expect(tile("latest")).toHaveTextContent("163.2lb");
  expect(tile("latest")).toHaveTextContent(`10-22 06:58 · ${(163.2 * LB).toFixed(1)} kg`);
  expect(tile("7-day trend")).toHaveTextContent("↓ 0.6 / week");
  expect(tile("30-day change")).toHaveTextContent("−2.9lb");
  expect(tile("30-day change")).toHaveTextContent("trend vs trend");
  expect(within(tile("30-day change")).getByText("−2.9")).toHaveClass("qs-ok-text");
  // Only in-range readings count in the status line; the glitch is excluded.
  expect(screen.getByText("31 readings", { selector: "b" })).toBeInTheDocument();
  expect(screen.getByText(/1 excluded/, { selector: "div" })).toBeInTheDocument();
});

it("shows both units, Δ vs trend and a PM badge in the table", async () => {
  setup();
  const table = await screen.findByRole("table", { name: "Weight readings" });
  const headers = within(table)
    .getAllByRole("columnheader")
    .map(h => h.textContent);
  expect(headers.slice(2, 5)).toEqual(["lb", "kg", "Δ trend"]);
  const evening = within(table).getByText("evening").closest('[role="row"]')!;
  expect(evening).toHaveTextContent("165.0");
  expect(evening).toHaveTextContent((165 * LB).toFixed(1));
  expect(within(evening as HTMLElement).getByText("pm")).toHaveClass("qs-badge-neutral");
  expect(within(evening as HTMLElement).getByText(/^\+/)).toHaveClass("qs-danger-text");
});

it("puts the selected unit first", async () => {
  setup(rows, "kg");
  const table = await screen.findByRole("table", { name: "Weight readings" });
  const headers = within(table)
    .getAllByRole("columnheader")
    .map(h => h.textContent);
  expect(headers.slice(2, 4)).toEqual(["kg", "lb"]);
});

it("switches unit and range through the parent", async () => {
  const props = setup();
  await screen.findByRole("table", { name: "Weight readings" });
  fireEvent.change(screen.getByRole("combobox", { name: "Display unit" }), {
    target: { value: "kg" },
  });
  expect(props.onUnit).toHaveBeenCalledWith("kg");
  await userEvent.setup().click(screen.getByRole("button", { name: "90d" }));
  expect(props.onRange).toHaveBeenCalledWith("2026-07-25", "2026-10-22");
});

it("marks imports and lets an excluded ghost open the table on that day", async () => {
  setup();
  const table = await screen.findByRole("table", { name: "Weight readings" });
  expect(await screen.findByText("apple health import · 10-01")).toBeInTheDocument();
  // The 184 lb glitch is far off the plotted scale, so no ghost is drawn for it.
  expect(screen.queryByRole("button", { name: /^Excluded reading/ })).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "○ show excluded" }));
  expect(within(table).getByText("excluded · scale glitch")).toBeInTheDocument();
});

it("draws an in-scale excluded reading as a ghost that reveals it in the table", async () => {
  setup([...history, reading("2026-10-10", 165, { uuid: "dupe", excluded: true, note: "dup" })]);
  const table = await screen.findByRole("table", { name: "Weight readings" });
  await userEvent
    .setup()
    .click(
      await screen.findByRole("button", { name: "Excluded reading 2026-10-10; review in table" })
    );
  expect(screen.getByRole("button", { name: "● show excluded" })).toBeInTheDocument();
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  expect(within(table).getByText("excluded · dup")).toBeInTheDocument();
});

it("renders an empty range", async () => {
  setup([]);
  expect(await screen.findByText("No readings match your filter.")).toBeInTheDocument();
  expect(screen.getByText("no readings in this range")).toBeInTheDocument();
});
