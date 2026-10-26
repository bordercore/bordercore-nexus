import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuantifiedSelfPage from "./QuantifiedSelfPage";
import { api, daysBefore } from "./api";
import { Dashboard, Day } from "./types";

vi.mock("./api", async importOriginal => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: vi.fn(),
  today: () => "2026-10-22",
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function dashboard(count: number): Dashboard {
  const days: Day[] = Array.from({ length: count }, (_, i) => ({
    date: daysBefore("2026-10-22", count - i - 1),
    resting_heart_rate: null,
    resting_heart_rate_trend: null,
    resting_heart_rate_samples: [],
    hrv: null,
    hrv_trend: null,
    hrv_samples: [],
    weight: null,
    weight_trend: null,
    weight_samples: [],
    systolic: null,
    diastolic: null,
    pulse: null,
    systolic_trend: null,
    diastolic_trend: null,
    pressure_samples: [],
    awakenings: null,
    status: "unreviewed",
    revision: null,
    note: "",
    events: [],
  }));
  return {
    days,
    unit: "lb",
    timezone: "America/New_York",
    histogram: [],
    summary: {
      resting_heart_rate_days: 0,
      resting_heart_rate_readings: 0,
      mean_resting_heart_rate: null,
      latest_resting_heart_rate: null,
      hrv_days: 0,
      hrv_readings: 0,
      mean_hrv: null,
      latest_hrv: null,
      completed_nights: 0,
      total_nights: count,
      mean_awakenings: null,
      recorded_awakenings: 0,
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

it("retains measured charts while a new range loads and when it arrives", async () => {
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: (entries: { contentRect: { width: number } }[]) => void) {}
      observe() {
        this.callback([{ contentRect: { width: 920 } }]);
      }
      disconnect = disconnect;
    }
  );
  let resolveRange!: (value: Dashboard) => void;
  vi.mocked(api)
    .mockResolvedValueOnce(dashboard(30))
    .mockImplementationOnce(
      () =>
        new Promise<Dashboard>(resolve => {
          resolveRange = resolve;
        }) as ReturnType<typeof api>
    );
  render(<QuantifiedSelfPage root="/quantified-self/" />);
  const timeline = await screen.findByRole("img", { name: /^Timeline of awakenings/ });
  const pressure = screen.getByRole("img", {
    name: "Daily mean systolic and diastolic blood pressure",
  });
  await waitFor(() => expect(timeline).toHaveAttribute("viewBox", "0 0 920 630"));
  // An active tooltip at the end of the old range must not leave an out-of-range
  // crosshair when the shorter range arrives.
  fireEvent.keyDown(timeline, { key: "ArrowLeft" });
  expect(timeline.querySelector(".qs-crosshair")).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "7d" }));
  expect(screen.getByRole("img", { name: /^Timeline of awakenings/ })).toBe(timeline);
  expect(timeline).toHaveAttribute("viewBox", "0 0 920 630");
  await act(async () => {
    resolveRange(dashboard(7));
  });
  expect(screen.getByRole("img", { name: /^Timeline of awakenings/ })).toBe(timeline);
  expect(
    screen.getByRole("img", { name: "Daily mean systolic and diastolic blood pressure" })
  ).toBe(pressure);
  expect(timeline).toHaveAttribute("viewBox", "0 0 920 630");
  expect(timeline).toHaveTextContent("10-16");
  expect(timeline.querySelector(".qs-crosshair")).toBeNull();
  expect(disconnect).not.toHaveBeenCalled();
});

it.each(["resting-heart-rate", "hrv"])(
  "opens the %s detail route without loading the overview",
  async tab => {
    window.history.replaceState(null, "", `/?tab=${tab}&start=2026-09-23&end=2026-10-22`);
    vi.mocked(api).mockResolvedValue({ count: 0, results: [] });
    render(<QuantifiedSelfPage root="/quantified-self/" />);
    expect(
      await screen.findByRole("table", {
        name: tab === "hrv" ? "HRV (SDNN) readings" : "Resting heart rate readings",
      })
    ).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(expect.stringContaining(`/${tab}/records/`));
    expect(vi.mocked(api).mock.calls.some(([url]) => url.includes("summary/"))).toBe(false);
  }
);
