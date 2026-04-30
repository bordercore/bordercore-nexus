import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const eventListeners: Record<string, ((data: unknown) => void)[]> = {};
const EventBusMock = vi.hoisted(() => ({
  $emit: vi.fn((event: string, data: unknown) => {
    (eventListeners[event] || []).forEach(cb => cb(data));
  }),
  $on: vi.fn((event: string, cb: (data: unknown) => void) => {
    eventListeners[event] = (eventListeners[event] || []).concat(cb);
  }),
  $off: vi.fn(),
}));

vi.mock("../utils/reactUtils", () => ({
  EventBus: EventBusMock,
}));

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
  it("renders all five cells", () => {
    render(<StatStrip stats={stats} initialTrack={null} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("synthwave")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("activates the pulsing dot on audio-play and clears on audio-pause", () => {
    const initial = { uuid: "s1", title: "Song", artist: "Art" };
    const { container } = render(<StatStrip stats={stats} initialTrack={initial} />);
    const dot = container.querySelector(".mlo-pulse");
    expect(dot).not.toBeNull();
    expect(dot!.classList.contains("mlo-pulse-playing")).toBe(false);

    act(() => EventBusMock.$emit("audio-play", { uuid: "s1" }));
    expect(dot!.classList.contains("mlo-pulse-playing")).toBe(true);

    act(() => EventBusMock.$emit("audio-pause", { uuid: "s1" }));
    expect(dot!.classList.contains("mlo-pulse-playing")).toBe(false);
  });
});
