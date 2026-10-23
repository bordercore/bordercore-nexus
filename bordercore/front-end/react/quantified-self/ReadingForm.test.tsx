import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReadingForm from "./ReadingForm";
import { api } from "./api";
vi.mock("./api", () => ({
  api: vi.fn(),
  errorText: () => "Save failed",
  today: () => "2026-01-10",
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("reading capture", () => {
  it("leaves unknown measurement times blank", async () => {
    vi.mocked(api).mockResolvedValue({});
    const onSaved = vi.fn();
    render(
      <ReadingForm
        kind="weight"
        root="/quantified-self/"
        unit="lb"
        onSaved={onSaved}
        onClose={vi.fn()}
      />
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Weight$/), "180");
    await user.click(screen.getByRole("button", { name: "Save reading" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/quantified-self/weight/records/",
        "POST",
        expect.objectContaining({ time: "", date: "2026-01-10", unit: "lb", value: "180" })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });
  it("keeps a failed edit open with the user's values", async () => {
    vi.mocked(api).mockRejectedValue(new Error("network"));
    const onClose = vi.fn();
    render(
      <ReadingForm
        kind="weight"
        root="/quantified-self/"
        unit="lb"
        onSaved={vi.fn()}
        onClose={onClose}
      />
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Weight$/), "185");
    await user.click(screen.getByRole("button", { name: "Save reading" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
    expect(screen.getByLabelText(/^Weight$/)).toHaveValue(185);
    expect(onClose).not.toHaveBeenCalled();
  });
  it("supports excluding an accidental awakening", async () => {
    vi.mocked(api).mockResolvedValue({});
    render(
      <ReadingForm
        kind="awakenings"
        root="/quantified-self/"
        unit="lb"
        onSaved={vi.fn()}
        onClose={vi.fn()}
        row={{
          uuid: "press",
          date: "2026-01-10",
          timestamp: "2026-01-10T02:15:00-05:00",
          source: "Wumpus",
          external_id: "e1",
          excluded: false,
          note: "",
        }}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/Exclude from charts/));
    await user.click(screen.getByRole("button", { name: "Save reading" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/quantified-self/awakenings/records/press/",
        "PUT",
        expect.objectContaining({
          date: "2026-01-10",
          time: "02:15:00",
          utc_offset: "-05:00",
          excluded: true,
        })
      )
    );
  });
});

it("accepts whole-number blood pressure in the browser's native validation", async () => {
  vi.mocked(api).mockResolvedValue({});
  render(
    <ReadingForm
      kind="blood-pressure"
      root="/quantified-self/"
      unit="lb"
      onSaved={vi.fn()}
      onClose={vi.fn()}
    />
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Systolic · mmHg"), "120");
  await user.type(screen.getByLabelText("Diastolic · mmHg"), "80");
  expect((screen.getByLabelText("Systolic · mmHg") as HTMLInputElement).validity.valid).toBe(true);
  await user.click(screen.getByRole("button", { name: "Save reading" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "/quantified-self/blood-pressure/records/",
      "POST",
      expect.objectContaining({ systolic: "120", diastolic: "80" })
    )
  );
});
