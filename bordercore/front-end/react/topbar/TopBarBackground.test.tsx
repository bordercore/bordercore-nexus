import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, act, waitFor } from "@testing-library/react";

// Stub the two animation components so the test cares only about which
// one the dispatcher chose, not about canvas internals.
vi.mock("./AuroraBg", () => ({
  default: () => <div data-testid="aurora-bg" />,
}));
vi.mock("./ConstellationBg", () => ({
  default: () => <div data-testid="constellation-bg" />,
}));
vi.mock("./FirefliesBg", () => ({
  default: () => <div data-testid="fireflies-bg" />,
}));

import TopBarBackground from "./TopBarBackground";

describe("TopBarBackground", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("topbar-animation");
  });

  it("renders AuroraBg when attribute is missing", () => {
    const { getByTestId } = render(<TopBarBackground />);
    expect(getByTestId("aurora-bg")).toBeTruthy();
  });

  it("renders AuroraBg for 'aurora'", () => {
    document.documentElement.setAttribute("topbar-animation", "aurora");
    const { getByTestId } = render(<TopBarBackground />);
    expect(getByTestId("aurora-bg")).toBeTruthy();
  });

  it("renders ConstellationBg for 'constellations'", () => {
    document.documentElement.setAttribute("topbar-animation", "constellations");
    const { getByTestId } = render(<TopBarBackground />);
    expect(getByTestId("constellation-bg")).toBeTruthy();
  });

  it("renders FirefliesBg for 'fireflies'", () => {
    document.documentElement.setAttribute("topbar-animation", "fireflies");
    const { getByTestId } = render(<TopBarBackground />);
    expect(getByTestId("fireflies-bg")).toBeTruthy();
  });

  it("renders nothing for 'none'", () => {
    document.documentElement.setAttribute("topbar-animation", "none");
    const { queryByTestId } = render(<TopBarBackground />);
    expect(queryByTestId("aurora-bg")).toBeNull();
    expect(queryByTestId("constellation-bg")).toBeNull();
    expect(queryByTestId("fireflies-bg")).toBeNull();
  });

  it("swaps the active component when the attribute changes at runtime", async () => {
    document.documentElement.setAttribute("topbar-animation", "aurora");
    const { getByTestId, queryByTestId } = render(<TopBarBackground />);
    expect(getByTestId("aurora-bg")).toBeTruthy();

    act(() => {
      document.documentElement.setAttribute("topbar-animation", "constellations");
    });
    // MutationObserver callbacks are async; wait for the re-render to settle.
    await waitFor(() => {
      expect(queryByTestId("aurora-bg")).toBeNull();
      expect(getByTestId("constellation-bg")).toBeTruthy();
    });
  });
});
