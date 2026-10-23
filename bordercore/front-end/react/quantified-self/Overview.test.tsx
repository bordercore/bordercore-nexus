import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Overview from "./Overview";
import { api } from "./api";
import { Dashboard, Day } from "./types";
vi.mock("./api", () => ({
  api: vi.fn(),
  errorText: () => "Night changed since it was displayed. Refresh and review it again.",
  today: () => "2026-01-10",
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function night(date: string, overrides: Partial<Day> = {}): Day {
  return {
    date,
    weight: null,
    weight_trend: null,
    systolic: null,
    diastolic: null,
    pulse: null,
    systolic_trend: null,
    diastolic_trend: null,
    weight_samples: [],
    pressure_samples: [],
    awakenings: null,
    status: "unreviewed",
    revision: null,
    note: "",
    events: [],
    ...overrides,
  };
}
const event = { uuid: "e1", hour: 15, time: "03:00", timestamp: "", note: "" };
const data: Dashboard = {
  days: [
    night("2026-01-08", { status: "complete", awakenings: 2, revision: "r8" }),
    night("2026-01-09", { events: [event], awakenings: 1, revision: "r9" }),
    night("2026-01-10"),
  ],
  unit: "lb",
  timezone: "America/New_York",
  histogram: Array.from({ length: 24 }, (_, i) => ({
    hour: `${String((i + 12) % 24).padStart(2, "0")}:00`,
    count: i === 15 ? 1 : 0,
  })),
  summary: {
    completed_nights: 1,
    total_nights: 3,
    mean_awakenings: 2,
    recorded_awakenings: 3,
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
function renderOverview(value: Dashboard | null = data, onSaved = vi.fn()) {
  render(
    <Overview
      data={value}
      root="/quantified-self/"
      unit="lb"
      onAdd={vi.fn()}
      onDay={vi.fn()}
      onExplore={vi.fn()}
      onSaved={onSaved}
    />
  );
  return onSaved;
}
it("shows pending values while the summary loads", () => {
  renderOverview(null);
  expect(screen.getAllByText("…").length).toBeGreaterThan(0);
  expect(screen.queryByText("no readings in this range")).not.toBeInTheDocument();
});
it("summarizes trackers and the peak waking hour", () => {
  renderOverview();
  expect(screen.getByRole("button", { name: /^awakenings\s*2\s*\/ night/ })).toBeInTheDocument();
  expect(screen.getByText("03:00")).toBeInTheDocument();
  expect(screen.getByText("● unreviewed")).toBeInTheDocument();
  expect(screen.getAllByText("no readings in this range")).toHaveLength(3);
});
it("makes an isolated pressure reading visible in the timeline and pressure chart", async () => {
  renderOverview({
    ...data,
    days: [
      night("2026-01-08"),
      night("2026-01-09", { systolic: 106, diastolic: 69 }),
      night("2026-01-10"),
    ],
  });
  const timeline = screen.getByRole("img", { name: /^Timeline of awakenings/ });
  const chart = screen.getByRole("img", {
    name: "Daily mean systolic and diastolic blood pressure",
  });
  for (const svg of [timeline, chart]) {
    expect(svg).toHaveTextContent("106/69 · 01-09");
    const connector = svg.querySelector(".qs-pressure-pair")!;
    expect(connector).toBeInTheDocument();
    expect(Number(connector.getAttribute("y1"))).toBeLessThan(Number(connector.getAttribute("y2")));
    expect(svg.querySelectorAll(".qs-dot-pressure circle")).toHaveLength(2);
  }
  expect(screen.getByRole("button", { name: "2026-01-09: 106/69 mmHg" })).toBeInTheDocument();
});
it("keeps sparse pressure days at distinct positions without labeling every point", () => {
  renderOverview({
    ...data,
    days: [
      night("2026-01-08", { systolic: 120, diastolic: 80 }),
      night("2026-01-09"),
      night("2026-01-10", { systolic: 106, diastolic: 69 }),
    ],
  });
  const timeline = screen.getByRole("img", { name: /^Timeline of awakenings/ });
  const pairs = timeline.querySelectorAll(".qs-pressure-pair");
  expect(pairs).toHaveLength(2);
  expect(Number(pairs[0].getAttribute("x1"))).toBeLessThan(Number(pairs[1].getAttribute("x1")));
  expect(timeline.querySelector(".qs-pressure-label")).toBeNull();
});
it("reviews a single night with its displayed revision", async () => {
  vi.mocked(api).mockResolvedValue({});
  const onSaved = renderOverview();
  await userEvent.setup().click(screen.getByLabelText("Mark 2026-01-09 complete"));
  expect(api).toHaveBeenCalledWith("/quantified-self/nights/review/", "POST", {
    nights: [{ date: "2026-01-09", revision: "r9", status: "complete" }],
  });
  expect(screen.queryByLabelText("Mark 2026-01-09 complete")).not.toBeInTheDocument();
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});
it("bulk-completes only nights without recorded events", async () => {
  vi.mocked(api).mockResolvedValue({});
  renderOverview();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: /mark 1 empty night complete/ }));
  expect(api).toHaveBeenCalledWith("/quantified-self/nights/review/", "POST", {
    nights: [{ date: "2026-01-10", revision: null, status: "complete" }],
  });
});
it("restores a night and explains a stale-revision conflict", async () => {
  vi.mocked(api).mockRejectedValue(new Error("conflict"));
  const onSaved = renderOverview();
  await userEvent.setup().click(screen.getByLabelText("Mark 2026-01-10 incomplete"));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Night changed since it was displayed"
  );
  expect(screen.getByLabelText("Mark 2026-01-10 incomplete")).toBeInTheDocument();
  expect(onSaved).toHaveBeenCalled();
});
it("bulk-completes only the empty nights on screen", async () => {
  vi.mocked(api).mockResolvedValue({});
  const days = Array.from({ length: 10 }, (_, i) =>
    night(`2026-01-${String(i + 1).padStart(2, "0")}`)
  );
  renderOverview({ ...data, days });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: /mark 8 empty nights complete/ }));
  const nights = vi.mocked(api).mock.calls[0][2] as { nights: { date: string }[] };
  expect(nights.nights.map(n => n.date)).toEqual(
    days
      .slice(2)
      .reverse()
      .map(d => d.date)
  );
});
