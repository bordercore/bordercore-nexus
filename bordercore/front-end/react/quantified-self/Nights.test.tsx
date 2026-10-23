import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Nights from "./Nights";
import { api } from "./api";
import { Day } from "./types";
vi.mock("./api", () => ({
  api: vi.fn(),
  errorText: () => "Night changed; refresh",
  today: () => "2026-01-10",
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const day: Day = {
  date: "2026-01-10",
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
};
it("confirms a zero-event night explicitly with its displayed revision", async () => {
  vi.mocked(api).mockResolvedValue({});
  render(<Nights days={[day]} root="/quantified-self/" onSaved={vi.fn()} onSelect={vi.fn()} />);
  expect(screen.getByText("—")).toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Select 2026-01-10"));
  await user.click(screen.getByRole("button", { name: "Confirm complete" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith("/quantified-self/nights/review/", "POST", {
      nights: [{ date: day.date, revision: null, status: "complete" }],
    })
  );
});
it("does not silently confirm stale review data", async () => {
  vi.mocked(api).mockRejectedValue(new Error("conflict"));
  const onSaved = vi.fn();
  render(<Nights days={[day]} root="/quantified-self/" onSaved={onSaved} onSelect={vi.fn()} />);
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Select 2026-01-10"));
  await user.click(screen.getByRole("button", { name: "Confirm complete" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Night changed");
  expect(onSaved).toHaveBeenCalled();
});
