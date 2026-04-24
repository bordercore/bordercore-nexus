import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ControlPanel from "./ControlPanel";
import type { Layer } from "./types";

function renderPanel(overrides: Partial<React.ComponentProps<typeof ControlPanel>> = {}) {
  const props: React.ComponentProps<typeof ControlPanel> = {
    nodeCount: 12,
    edgeCount: 34,
    layers: new Set<Layer>(["direct", "tags"]),
    onToggleLayer: vi.fn(),
    ...overrides,
  };
  return { ...render(<ControlPanel {...props} />), props };
}

describe("ControlPanel", () => {
  it("renders item and connection counts", () => {
    renderPanel();
    expect(screen.getByText(/12 items · 34 connections/i)).toBeInTheDocument();
  });

  it("uses singular nouns when counts are 1", () => {
    renderPanel({ nodeCount: 1, edgeCount: 1 });
    expect(screen.getByText(/1 item · 1 connection/i)).toBeInTheDocument();
  });

  it("shows shared tags as checked when in the layers set", () => {
    renderPanel({ layers: new Set<Layer>(["direct", "tags"]) });
    const tagsToggle = screen.getByLabelText(/Shared tags/i) as HTMLInputElement;
    expect(tagsToggle.checked).toBe(true);
  });

  it("shows shared collections as unchecked by default", () => {
    renderPanel({ layers: new Set<Layer>(["direct", "tags"]) });
    const collectionsToggle = screen.getByLabelText(/Shared collections/i) as HTMLInputElement;
    expect(collectionsToggle.checked).toBe(false);
  });

  it("invokes onToggleLayer when shared tags checkbox is clicked", async () => {
    const onToggleLayer = vi.fn();
    renderPanel({ onToggleLayer });
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/Shared tags/i));
    expect(onToggleLayer).toHaveBeenCalledWith("tags");
  });

  it("invokes onToggleLayer when shared collections checkbox is clicked", async () => {
    const onToggleLayer = vi.fn();
    renderPanel({ onToggleLayer });
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/Shared collections/i));
    expect(onToggleLayer).toHaveBeenCalledWith("collections");
  });

  it("renders direct links as locked (no checkbox input)", () => {
    renderPanel();
    expect(screen.queryByLabelText(/Direct links/i)).toBeNull();
    expect(screen.getByText(/Direct links/i)).toBeInTheDocument();
  });
});
