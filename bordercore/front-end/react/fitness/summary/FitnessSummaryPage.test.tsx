import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FitnessSummaryPage } from "./FitnessSummaryPage";
import type { ExerciseCardData, SummaryPayload } from "./types";

const DETAILS_URL = "/fitness/inactive_card_details/";

function card(overrides: Partial<ExerciseCardData> = {}): ExerciseCardData {
  return {
    uuid: "u-1",
    name: "Bench Press",
    exercise_url: "/fitness/u-1/",
    is_active: true,
    status: "on_track",
    is_today: false,
    overdue_days: 0,
    group: "chest",
    group_label: "Chest",
    group_color_token: "--muscle-chest",
    schedule: [true, false, false, false, false, false, false],
    last_workout_days_ago: 2,
    last_weight: 200,
    last_reps: 8,
    sparkline: [1, 2, 3],
    sparkline_metric: "weight",
    ...overrides,
  };
}

function payloadWith(exercises: ExerciseCardData[]): SummaryPayload {
  return {
    today_dow: 0,
    groups: [{ slug: "chest", label: "Chest", color_token: "--muscle-chest" }],
    exercises,
  };
}

// One active card plus an inactive one shipped without sparkline data.
const PAYLOAD = payloadWith([
  card(),
  card({
    uuid: "u-2",
    name: "Push Ups",
    is_active: false,
    last_weight: null,
    last_reps: null,
    sparkline: [],
    sparkline_metric: null,
  }),
]);

function mockDetails() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      details: {
        "u-2": {
          last_weight: 150,
          last_reps: 12,
          sparkline: [4, 5, 6],
          sparkline_metric: "weight",
        },
      },
    }),
  });
}

function expandInactive() {
  fireEvent.click(screen.getByRole("button", { name: /show inactive/i }));
}

describe("FitnessSummaryPage completed-today mark", () => {
  function cardFor(name: string) {
    return screen.getByText(name).closest(".fitness-card");
  }

  it("stamps a check mark on a card worked today", () => {
    render(
      <FitnessSummaryPage
        payload={payloadWith([
          card({ uuid: "u-1", name: "Bench Press", last_workout_days_ago: 0 }),
          card({ uuid: "u-2", name: "Squat", last_workout_days_ago: 3 }),
        ])}
      />
    );

    expect(cardFor("Bench Press")).toHaveAttribute("data-done", "1");
    expect(cardFor("Squat")).toHaveAttribute("data-done", "0");
    expect(screen.getAllByLabelText("completed today")).toHaveLength(1);
    expect(cardFor("Bench Press")).toContainElement(screen.getByLabelText("completed today"));
  });

  it("leaves a card with no workout history unmarked", () => {
    render(
      <FitnessSummaryPage
        payload={payloadWith([card({ name: "Deadlift", last_workout_days_ago: null })])}
      />
    );

    expect(cardFor("Deadlift")).toHaveAttribute("data-done", "0");
    expect(screen.queryByLabelText("completed today")).not.toBeInTheDocument();
  });
});

describe("FitnessSummaryPage inactive-card details", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockDetails());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not fetch details on first paint", () => {
    render(<FitnessSummaryPage payload={PAYLOAD} inactiveDetailsUrl={DETAILS_URL} />);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches details when the inactive section is expanded", async () => {
    render(<FitnessSummaryPage payload={PAYLOAD} inactiveDetailsUrl={DETAILS_URL} />);
    expandInactive();

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      DETAILS_URL,
      expect.objectContaining({ method: "GET", credentials: "same-origin" })
    );
  });

  it("merges fetched details into the inactive cards", async () => {
    render(<FitnessSummaryPage payload={PAYLOAD} inactiveDetailsUrl={DETAILS_URL} />);
    expandInactive();

    // The fetched last-set summary (150 x 12) replaces the blank placeholder.
    await waitFor(() => expect(screen.getByText("150 × 12")).toBeInTheDocument());
  });

  it("does not refetch when the section is collapsed and reopened", async () => {
    render(<FitnessSummaryPage payload={PAYLOAD} inactiveDetailsUrl={DETAILS_URL} />);

    expandInactive();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /hide inactive/i }));
    expandInactive();

    await waitFor(() => expect(screen.getByText("150 × 12")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("allows a retry on the next expand when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<FitnessSummaryPage payload={PAYLOAD} inactiveDetailsUrl={DETAILS_URL} />);
    expandInactive();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    // The card is still listed — a missing sparkline is not a failure state.
    expect(screen.getByText("Push Ups")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /hide inactive/i }));
    expandInactive();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("skips the fetch when no details URL is configured", () => {
    render(<FitnessSummaryPage payload={PAYLOAD} />);
    expandInactive();
    expect(fetch).not.toHaveBeenCalled();
  });
});
