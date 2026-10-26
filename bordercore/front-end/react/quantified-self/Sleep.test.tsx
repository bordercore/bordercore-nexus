import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sleep, { SleepOverview, SleepStageChart } from "./Sleep";
import { api } from "./api";
import { SleepData, SleepDay } from "./types";

vi.mock("./api", async importOriginal => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: vi.fn(),
  today: () => "2026-10-26",
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const source = { id: 1, name: "Google Health", latest: "2026-10-26T08:00:00Z" };
const secondSource = { ...source, id: 2, name: "Apple Health · Watch" };
function day(date: string): SleepDay {
  return {
    date,
    asleep_seconds: 7 * 3600,
    trend_seconds: 6.5 * 3600,
    duration_basis: "reported",
    stages: { awake: 600, light: 18000, deep: 3600, rem: 3600, asleep: 0, restless: 0, in_bed: 0 },
    session_count: 1,
    bedtime: `${date}T00:00:00-04:00`,
    wake_time: `${date}T07:10:00-04:00`,
    recorded_awakenings: 1,
    intervals: [{ start: `${date}T00:00:00-04:00`, end: `${date}T01:00:00-04:00`, stage: "deep" }],
  };
}
const days = [day("2026-10-25"), day("2026-10-26")];
function response(rows = days, selectedSource = source): SleepData {
  return {
    days: rows,
    source: selectedSource,
    sources: [source, secondSource],
    timezone: "America/New_York",
    summary: {
      nights: rows.length,
      mean_seconds: rows.length ? 25200 : null,
      latest: rows.at(-1) ?? null,
    },
    events: [{ uuid: "press", timestamp: "2026-10-26T04:00:00-04:00", source: "Bedroom switch" }],
  };
}
const props = {
  root: "/qs/",
  start: "2026-10-20",
  end: "2026-10-26",
  revision: 0,
  onRange: vi.fn(),
  onImport: vi.fn(),
};

it("selects nights from the duration chart and reloads detail for the chosen source", async () => {
  vi.mocked(api).mockImplementation(async url => {
    const parsed = new URL(url, "https://example.test");
    const selectedSource = parsed.searchParams.get("source") === "2" ? secondSource : source;
    const date = parsed.searchParams.get("date");
    return response(date ? [day(date)] : days, selectedSource) as never;
  });
  render(<Sleep {...props} />);
  expect(
    await screen.findByRole("img", { name: /Sleep stages and logged awakenings for 2026-10-26/ })
  ).toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "2026-10-25: 7h 00m; view sleep stages" }));
  expect(
    await screen.findByRole("img", { name: /Sleep stages and logged awakenings for 2026-10-25/ })
  ).toBeInTheDocument();
  await user.selectOptions(screen.getByRole("combobox", { name: "Sleep source" }), "2");
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith("/qs/sleep/night/?date=2026-10-25&source=2")
  );
  await user.click(screen.getByRole("button", { name: "30d" }));
  expect(props.onRange).toHaveBeenCalledWith("2026-09-27", "2026-10-26");
});

it("ignores an old night response after switching nights", async () => {
  let resolveOld!: (value: SleepData) => void;
  vi.mocked(api)
    .mockResolvedValueOnce(response())
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveOld = resolve;
        })
    )
    .mockResolvedValueOnce(response([days[0]]));
  render(<Sleep {...props} />);
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  await userEvent.click(
    screen.getByRole("button", { name: "2026-10-25: 7h 00m; view sleep stages" })
  );
  await screen.findByRole("img", { name: /Sleep stages and logged awakenings for 2026-10-25/ });
  resolveOld(response([days[1]]));
  await waitFor(() =>
    expect(
      screen.queryByRole("img", { name: /Sleep stages and logged awakenings for 2026-10-26/ })
    ).not.toBeInTheDocument()
  );
});

it("provides an import entry point when no sleep is recorded", async () => {
  vi.mocked(api).mockResolvedValue(response([]));
  render(<Sleep {...props} />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Import Apple Health sleep data" })
  );
  expect(props.onImport).toHaveBeenCalled();
  expect(screen.queryByRole("combobox", { name: "Night to inspect" })).not.toBeInTheDocument();
});

it("links the overview chart to the selected night's detail", async () => {
  const onOpen = vi.fn();
  render(<SleepOverview data={response()} loading={false} onOpen={onOpen} />);
  await userEvent.click(
    screen.getByRole("button", { name: "2026-10-25: 7h 00m; view sleep stages" })
  );
  expect(onOpen).toHaveBeenCalledWith("2026-10-25");
});

it("shows gaps and button presses independently of device stages", () => {
  const { container } = render(
    <SleepStageChart day={days[1]} events={response().events!} zone="America/New_York" />
  );
  expect(container.querySelectorAll("rect.qs-stage-deep")).toHaveLength(1);
  expect(screen.getByLabelText("Logged awakening at 4:00 AM EDT")).toBeInTheDocument();
  expect(screen.getByLabelText("Deep, 12:00 AM EDT to 1:00 AM EDT")).toBeInTheDocument();
});
