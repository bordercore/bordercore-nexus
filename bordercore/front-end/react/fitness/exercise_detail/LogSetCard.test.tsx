import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogSetCard } from "./LogSetCard";
import { doPost } from "../../utils/reactUtils";

vi.mock("../../utils/reactUtils", () => ({
  doPost: vi.fn(),
}));

const baseProps = {
  hasWeight: true,
  hasReps: true,
  hasDuration: true,
  logSetUrl: "/log/",
  deleteSetUrl: "/delete/",
  defaultWeight: "0",
  defaultReps: "0",
  defaultDuration: "0",
};

describe("LogSetCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides the reps input when the exercise has no reps", () => {
    render(<LogSetCard {...baseProps} hasReps={false} />);
    expect(screen.queryByLabelText("reps")).not.toBeInTheDocument();
    expect(screen.getByLabelText("weight · lb")).toBeInTheDocument();
    expect(screen.getByLabelText("duration · sec")).toBeInTheDocument();
  });

  it("logs a duration and weight set with reps=0 when the exercise has no reps", async () => {
    render(<LogSetCard {...baseProps} hasReps={false} defaultWeight="25" defaultDuration="90" />);
    await userEvent.click(screen.getByRole("button", { name: /log set/i }));
    expect(doPost).toHaveBeenCalledWith(
      "/log/",
      expect.objectContaining({ weight: "25", reps: "0", duration: "90" }),
      expect.any(Function),
      "",
      "Error logging set"
    );
  });

  it("does not submit a rep-less set when weight and duration are both zero", async () => {
    render(<LogSetCard {...baseProps} hasReps={false} />);
    await userEvent.click(screen.getByRole("button", { name: /log set/i }));
    expect(doPost).not.toHaveBeenCalled();
  });

  it("still requires positive reps when the exercise has reps", async () => {
    render(<LogSetCard {...baseProps} defaultWeight="100" defaultReps="0" />);
    await userEvent.click(screen.getByRole("button", { name: /log set/i }));
    expect(doPost).not.toHaveBeenCalled();
  });

  it("logs a reps-based set unchanged when the exercise has reps", async () => {
    render(<LogSetCard {...baseProps} defaultWeight="100" defaultReps="8" />);
    await userEvent.click(screen.getByRole("button", { name: /log set/i }));
    expect(doPost).toHaveBeenCalledWith(
      "/log/",
      expect.objectContaining({ weight: "100", reps: "8", duration: "0" }),
      expect.any(Function),
      "",
      "Error logging set"
    );
  });

  it("shows weight and duration columns in the log table when the exercise has no reps", () => {
    render(<LogSetCard {...baseProps} hasReps={false} />);
    const head = document.querySelector(".ex-log-head") as HTMLElement;
    expect(head.textContent).toContain("weight");
    expect(head.textContent).toContain("duration");
    expect(head.textContent).not.toContain("reps");
  });
});
