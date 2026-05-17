import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { WeekChips } from "./WeekChips";

function chips(days: number[]): HTMLElement[] {
  const { container } = render(<WeekChips days={days} />);
  return Array.from(container.querySelectorAll(".rm-weekchip"));
}

describe("WeekChips", () => {
  it("renders seven chips labelled M T W T F S S", () => {
    const els = chips([]);
    expect(els.map(e => e.textContent)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
  });

  it("lights up only the chips for the given days", () => {
    const els = chips([0, 2, 6]);
    expect(els.map(e => e.classList.contains("is-lit"))).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      true,
    ]);
  });

  it("renders no lit chips when days is empty", () => {
    const els = chips([]);
    expect(els.every(e => !e.classList.contains("is-lit"))).toBe(true);
  });

  it("lights all chips when every day is included", () => {
    const els = chips([0, 1, 2, 3, 4, 5, 6]);
    expect(els.every(e => e.classList.contains("is-lit"))).toBe(true);
  });

  it("exposes an accessible label on the wrapper", () => {
    const { container } = render(<WeekChips days={[]} />);
    expect(container.querySelector(".rm-weekchips")?.getAttribute("aria-label")).toBe(
      "weekly schedule days"
    );
  });
});
