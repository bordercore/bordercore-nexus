import React from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Cardiac, { cardiacDailyMeans, cardiacTrend } from "./Cardiac";
import ReadingForm from "./ReadingForm";
import { api } from "./api";
import { CardiacKind, Reading, cardiacMetrics } from "./types";

vi.mock("./api", async importOriginal => ({
  ...(await importOriginal<typeof import("./api")>()),
  api: vi.fn(),
  today: () => "2026-10-22",
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function reading(date: string, value: number, extra: Partial<Reading> = {}): Reading {
  return {
    uuid: `${date}-${value}`,
    date,
    value: String(value),
    source: "Apple Health · Watch",
    external_id: "",
    note: "",
    excluded: false,
    time: "08:00:00",
    ...extra,
  };
}
const rows = [
  reading("2026-10-18", 40),
  reading("2026-10-18", 60, { time: "09:00:00" }),
  reading("2026-10-22", 80),
  reading("2026-10-22", 999, { excluded: true, note: "glitch" }),
];
function setup(kind: CardiacKind) {
  vi.mocked(api).mockResolvedValue({ count: rows.length, results: rows });
  const props = {
    kind,
    root: "/quantified-self/",
    start: "2026-09-23",
    end: "2026-10-22",
    revision: 0,
    onRange: vi.fn(),
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onChanged: vi.fn(),
  };
  render(<Cardiac {...props} />);
  return props;
}

it("averages days equally, skips excluded readings and leaves missing days empty", () => {
  const means = cardiacDailyMeans(rows);
  expect(means.get("2026-10-18")?.value).toBe(50);
  expect(means.get("2026-10-19")).toBeUndefined();
  expect(cardiacTrend(means, "2026-10-22")).toBe(65);
  expect(cardiacTrend(means, "2026-10-25")).toBe(80);
  expect(cardiacTrend(means, "2026-10-30")).toBeNull();
});

it.each(["resting-heart-rate", "hrv"] as CardiacKind[])(
  "shows %s, filters chart selections and supports edits",
  async kind => {
    const props = setup(kind);
    const { label, unit } = cardiacMetrics[kind];
    const table = await screen.findByRole("table", { name: `${label} readings` });
    expect(api).toHaveBeenCalledWith(
      `/quantified-self/${kind}/records/?start=2026-08-17&end=2026-10-22&limit=20000`
    );
    expect(
      screen.getByText("latest", { selector: ".qs-kpi-label" }).parentElement
    ).toHaveTextContent(`80.0${unit}`);
    expect(
      screen.getByText("7-day trend", { selector: ".qs-kpi-label" }).parentElement
    ).toHaveTextContent(`65.0${unit}`);
    expect(within(table).queryByText("999.0")).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: `2026-10-18: 50.0 ${unit}; show readings` })
    );
    expect(within(table).queryByText("80.0")).not.toBeInTheDocument();
    await user.click(within(table).getAllByRole("button", { name: /edit/i })[0]);
    expect(props.onEdit).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /export/i })).toHaveAttribute(
      "href",
      expect.stringContaining(`/${kind}/export/`)
    );
    await user.click(screen.getByRole("button", { name: "90d" }));
    expect(props.onRange).toHaveBeenCalledWith("2026-07-25", "2026-10-22");
  }
);

it("loads subsequent record pages instead of silently truncating HRV history", async () => {
  vi.mocked(api)
    .mockResolvedValueOnce({ count: 2, results: [rows[0]] })
    .mockResolvedValueOnce({ count: 2, results: [rows[2]] });
  render(
    <Cardiac
      kind="hrv"
      root="/qs/"
      start="2026-10-01"
      end="2026-10-22"
      revision={0}
      onRange={vi.fn()}
      onAdd={vi.fn()}
      onEdit={vi.fn()}
      onChanged={vi.fn()}
    />
  );
  const table = await screen.findByRole("table", { name: "HRV (SDNN) readings" });
  expect(within(table).getByText("40.0")).toBeInTheDocument();
  expect(within(table).getByText("80.0")).toBeInTheDocument();
  expect(api).toHaveBeenLastCalledWith(expect.stringContaining("&offset=1"));
});

it.each(["resting-heart-rate", "hrv"] as CardiacKind[])(
  "saves %s with its fixed unit rather than the weight preference",
  async kind => {
    vi.mocked(api).mockResolvedValue({});
    render(<ReadingForm kind={kind} root="/qs/" unit="lb" onSaved={vi.fn()} onClose={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("spinbutton"), "48.123456");
    await user.click(screen.getByRole("button", { name: "Save reading" }));
    expect(api).toHaveBeenCalledWith(
      `/qs/${kind}/records/`,
      "POST",
      expect.objectContaining({ value: "48.123456", unit: cardiacMetrics[kind].unit })
    );
  }
);
