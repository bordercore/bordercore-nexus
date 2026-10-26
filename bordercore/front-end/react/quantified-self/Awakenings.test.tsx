import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Awakenings, { nightlyMean, peakHour, quietStreak } from "./Awakenings";
import QuantifiedSelfPage from "./QuantifiedSelfPage";
import { api, daysBefore } from "./api";
import { Dashboard, Day, Status } from "./types";

vi.mock("./api", async importOriginal => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: vi.fn(),
  today: () => "2026-10-24",
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/");
});

function night(date: string, status: Status = "unreviewed", hours: number[] = []): Day {
  return {
    date,
    weight: null,
    weight_trend: null,
    weight_samples: [],
    systolic: null,
    diastolic: null,
    pulse: null,
    systolic_trend: null,
    diastolic_trend: null,
    pressure_samples: [],
    awakenings: hours.length || status === "complete" ? hours.length : null,
    status,
    revision: `r-${date}`,
    note: "",
    events: hours.map((hour, i) => {
      const clock = Math.floor((hour + 12) % 24);
      return {
        uuid: `${date}-${i}`,
        hour,
        time: `${String(clock).padStart(2, "0")}:15:00 -0400`,
        timestamp: "",
        note: "",
        source: "Wumpus",
      };
    }),
  };
}

// Ten nights ending 10-24: three complete with events, a confirmed-zero
// streak of two, one incomplete, and unreviewed nights with and without events.
const nights: Day[] = [
  night("2026-10-15", "complete", [14, 15]),
  night("2026-10-16", "complete", [15]),
  night("2026-10-17", "complete"),
  night("2026-10-18", "complete"),
  night("2026-10-19", "incomplete", [12]),
  night("2026-10-20", "complete", [14, 15, 16]),
  night("2026-10-21"),
  night("2026-10-22"),
  night("2026-10-23", "unreviewed", [13]),
  night("2026-10-24", "unreviewed", [12.9, 14, 15, 16, 17]),
];

function dashboard(days: Day[]): Dashboard {
  const histogram = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String((i + 12) % 24).padStart(2, "0")}:00`,
    count: days.flatMap(d => d.events).filter(e => Math.floor(e.hour) === i).length,
  }));
  return {
    days,
    unit: "lb",
    timezone: "America/New_York",
    histogram,
    summary: {
      completed_nights: days.filter(d => d.status === "complete").length,
      total_nights: days.length,
      mean_awakenings: null,
      recorded_awakenings: days.flatMap(d => d.events).length,
      weight_days: 0,
      pressure_days: 0,
      pressure_readings: 0,
      mean_systolic: null,
      mean_diastolic: null,
      latest_weight: null,
      weight_change: null,
      latest_pressure: null,
    },
  };
}

function setup(current = nights, previous: Day[] = []) {
  vi.mocked(api).mockImplementation(
    url =>
      Promise.resolve(
        String(url).includes("start=2026-10-15") ? dashboard(current) : dashboard(previous)
      ) as ReturnType<typeof api>
  );
  const props = {
    root: "/quantified-self/",
    start: "2026-10-15",
    end: "2026-10-24",
    revision: 0,
    onRange: vi.fn(),
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onChanged: vi.fn(),
  };
  const view = render(<Awakenings {...props} />);
  return { props, view };
}

it("derives the mean, quiet streak and peak hour from complete nights only", () => {
  expect(nightlyMean(nights)).toBeCloseTo(6 / 5);
  expect(quietStreak(nights)).toEqual({ from: "2026-10-17", to: "2026-10-18", length: 2 });
  expect(peakHour(dashboard(nights).histogram)).toMatchObject({
    hour: "03:00",
    count: 4,
    total: 13,
    from: "02:00",
    to: "05:00",
  });
  expect(peakHour(dashboard([night("2026-10-24", "complete", [14])]).histogram)).toBeNull();
});

it("fills the status line and KPI strip, comparing with the previous period", async () => {
  const previous = [1, 2, 3, 4].map(i =>
    night(daysBefore("2026-10-15", i), "complete", [14, 15, 16])
  );
  setup(nights, previous);
  expect(api).toHaveBeenCalledWith(
    "/quantified-self/summary/?start=2026-10-05&end=2026-10-14&unit=lb"
  );
  await screen.findByRole("table", { name: "Nightly timeline" });
  const status = document.querySelector(".qs-statusline-nowrap");
  expect(status).toHaveTextContent(
    "2026-10-15 → 2026-10-24 · 10 nights · 5 complete · 1 incomplete · 4 unreviewed · 13 events"
  );
  const tile = (label: string) =>
    screen.getByText(label, { selector: ".qs-kpi-label" }).parentElement!;
  expect(tile("last night")).toHaveTextContent("5recorded");
  expect(tile("last night")).toHaveTextContent("first 00:15 · last 05:15");
  expect(tile("nightly mean")).toHaveTextContent("1.2/ night");
  expect(within(tile("nightly mean")).getByText(/vs previous 10/)).toHaveClass("qs-ok-text");
  expect(tile("review coverage")).toHaveTextContent("5/10");
  expect(tile("review coverage")).toHaveTextContent("4 unreviewed · 2 have no events");
  expect(tile("peak hour")).toHaveTextContent("03:00");
  expect(tile("peak hour")).toHaveTextContent("69% between 02:00–05:00");
  expect(tile("longest quiet streak")).toHaveTextContent("2nights");
});

it("zooms the nightly timeline to 10 pm–9 am with correctly aligned overnight events", async () => {
  const day = night("2026-10-24", "unreviewed", [10 - 1 / 3600, 10, 12, 15, 18, 21 - 1 / 3600, 21]);
  const times = [
    "21:59:59",
    "22:00:00",
    "00:00:00",
    "03:00:00",
    "06:00:00",
    "08:59:59",
    "09:00:00",
  ];
  day.events.forEach((event, i) => (event.time = `${times[i]} -0400`));
  setup([day]);
  const first = await screen.findByRole("img", { name: "Awakening 22:00:00 -0400 · Wumpus" });
  const table = screen.getByRole("table", { name: "Nightly timeline" });
  expect(within(table).getByText("10 pm")).toBeVisible();
  expect(within(table).getByText("9 am")).toBeVisible();
  expect(within(table).queryByText("noon")).toBeNull();
  expect(within(table).queryByRole("img", { name: /21:59:59|09:00:00/ })).toBeNull();
  const dots = within(table).getAllByRole("img", { name: /^Awakening/ });
  expect(dots).toHaveLength(5);
  const width = Number(first.closest("svg")!.getAttribute("viewBox")!.split(" ")[2]);
  for (const [i, fraction] of [0, 2 / 11, 5 / 11, 8 / 11, (11 - 1 / 3600) / 11].entries()) {
    expect(Number(dots[i].getAttribute("cx")) / width).toBeCloseTo(fraction, 5);
  }
  const midnight = within(table).getByText("midnight");
  expect(midnight.getAttribute("x")).toBe(dots[1].getAttribute("cx"));
  // Zooming the display must not change full-night totals or remove editable records.
  expect(within(table).getByRole("cell", { name: "7" })).toBeVisible();
});

it("reviews one night with its revision and shows it optimistically", async () => {
  const { props } = setup();
  const table = await screen.findByRole("table", { name: "Nightly timeline" });
  vi.mocked(api).mockClear();
  vi.mocked(api).mockResolvedValueOnce({ updated: 1 });
  await userEvent
    .setup()
    .click(within(table).getByRole("button", { name: "Confirm 2026-10-22 complete" }));
  expect(api).toHaveBeenCalledWith("/quantified-self/nights/review/", "POST", {
    nights: [{ date: "2026-10-22", revision: "r-2026-10-22", status: "complete" }],
  });
  const row = table.querySelector("#qs-night-2026-10-22")!;
  expect(row).toHaveTextContent("✓ complete");
  await waitFor(() => expect(props.onChanged).toHaveBeenCalled());
});

it("rolls back and explains a conflicting review", async () => {
  setup();
  const table = await screen.findByRole("table", { name: "Nightly timeline" });
  vi.mocked(api).mockRejectedValueOnce(new Error("Night changed since it was displayed."));
  await userEvent
    .setup()
    .click(within(table).getByRole("button", { name: "Mark 2026-10-21 incomplete" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Night changed");
  expect(table.querySelector("#qs-night-2026-10-21")).toHaveTextContent("● unreviewed");
});

it("bulk-reviews a shift-selected range and offers to select empty nights", async () => {
  setup();
  const table = await screen.findByRole("table", { name: "Nightly timeline" });
  const user = userEvent.setup();
  expect(screen.queryByRole("region", { name: "Bulk review" })).toBeNull();
  await user.click(within(table).getByLabelText("Select 2026-10-24"));
  await user.keyboard("{Shift>}");
  await user.click(within(table).getByLabelText("Select 2026-10-22"));
  await user.keyboard("{/Shift}");
  const bulk = screen.getByRole("region", { name: "Bulk review" });
  expect(bulk).toHaveTextContent("3 selected");
  await user.click(within(bulk).getByRole("button", { name: "· select all 2 empty unreviewed" }));
  expect(bulk).toHaveTextContent("2 selected");
  vi.mocked(api).mockResolvedValueOnce({ updated: 2 });
  await user.click(within(bulk).getByRole("button", { name: "✓ confirm complete" }));
  expect(api).toHaveBeenCalledWith("/quantified-self/nights/review/", "POST", {
    nights: [
      { date: "2026-10-21", revision: "r-2026-10-21", status: "complete" },
      { date: "2026-10-22", revision: "r-2026-10-22", status: "complete" },
    ],
  });
  await waitFor(() => expect(screen.queryByRole("region", { name: "Bulk review" })).toBeNull());
});

it("clears the selection with Escape and filters by status and empty nights", async () => {
  setup();
  const table = await screen.findByRole("table", { name: "Nightly timeline" });
  const user = userEvent.setup();
  await user.click(within(table).getByLabelText("Select 2026-10-24"));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("region", { name: "Bulk review" })).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
    target: { value: "complete" },
  });
  expect(within(table).getAllByRole("row")).toHaveLength(6);
  fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
    target: { value: "all" },
  });
  await user.click(screen.getByRole("button", { name: "○ hide empty nights" }));
  expect(within(table).getAllByRole("row")).toHaveLength(9);
});

it("prefills the editor with now, or with a night's date", async () => {
  const { props } = setup();
  const table = await screen.findByRole("table", { name: "Nightly timeline" });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^awakening/ }));
  expect(props.onAdd).toHaveBeenCalledWith({
    date: "2026-10-24",
    time: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
  });
  await user.click(
    within(table).getByRole("button", { name: "Add an awakening to the night ending 2026-10-21" })
  );
  expect(props.onAdd).toHaveBeenLastCalledWith({ date: "2026-10-21" });
  expect(
    within(table).queryByRole("button", { name: "Edit awakenings for the night ending 2026-10-21" })
  ).toBeNull();
});

it("opens a night's events with edit and restore for excluded ones", async () => {
  const { props } = setup();
  const table = await screen.findByRole("table", { name: "Nightly timeline" });
  vi.mocked(api).mockImplementation(
    url =>
      Promise.resolve(
        String(url).includes("/awakenings/records/")
          ? {
              count: 2,
              results: [
                {
                  uuid: "kept",
                  source: "Wumpus",
                  external_id: "",
                  note: "",
                  excluded: false,
                  date: "2026-10-23",
                  timestamp: "2026-10-23T01:15:00-04:00",
                },
                {
                  uuid: "dropped",
                  source: "Wumpus",
                  external_id: "",
                  note: "double press",
                  excluded: true,
                  date: "2026-10-23",
                  timestamp: "2026-10-23T01:15:02-04:00",
                },
              ],
            }
          : dashboard(nights)
      ) as ReturnType<typeof api>
  );
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  const user = userEvent.setup();
  await user.click(
    within(table).getByRole("button", { name: "Edit awakenings for the night ending 2026-10-23" })
  );
  expect(await screen.findByText("excluded · double press")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "edit" }));
  expect(props.onEdit).toHaveBeenCalledWith(expect.objectContaining({ uuid: "kept" }));
  await user.click(screen.getByRole("button", { name: "restore" }));
  expect(api).toHaveBeenCalledWith("/quantified-self/awakenings/records/dropped/", "PATCH", {
    excluded: false,
  });
});

it("shows an empty range without placeholder messages while loading", async () => {
  const resolvers: ((value: Dashboard) => void)[] = [];
  vi.mocked(api).mockImplementation(
    () => new Promise<Dashboard>(r => resolvers.push(r)) as ReturnType<typeof api>
  );
  render(
    <Awakenings
      root="/quantified-self/"
      start="2026-10-15"
      end="2026-10-24"
      revision={0}
      onRange={vi.fn()}
      onAdd={vi.fn()}
      onEdit={vi.fn()}
      onChanged={vi.fn()}
    />
  );
  expect(screen.queryByText(/Loading/)).toBeNull();
  expect(screen.queryByText("No nights match your filter.")).toBeNull();
  await act(async () => resolvers.forEach(r => r(dashboard([]))));
  expect(screen.getByText("No nights match your filter.")).toBeInTheDocument();
});

it("routes the awakenings tab to the detail page", async () => {
  window.history.replaceState(null, "", "/?tab=awakenings&start=2026-10-15&end=2026-10-24");
  vi.mocked(api).mockResolvedValue(dashboard(nights));
  render(<QuantifiedSelfPage root="/quantified-self/" />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Awakenings");
  expect(document.querySelector(".qs-page")).toHaveClass("qs-accent-purple");
  expect(await screen.findByRole("table", { name: "Nightly timeline" })).toBeInTheDocument();
});
