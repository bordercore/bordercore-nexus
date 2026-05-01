import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StatStrip from "./StatStrip";
import type { DashboardStats } from "./types";

const stats: DashboardStats = {
  plays_this_week: 42,
  top_tag_7d: { name: "synthwave", count: 9 },
  added_this_month: 3,
  longest_streak: 7,
  plays_today: 5,
};

describe("StatStrip", () => {
  it("renders the four stat cells", () => {
    render(<StatStrip stats={stats} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("synthwave")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
