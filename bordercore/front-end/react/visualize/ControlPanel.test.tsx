import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ControlPanel, { clusterDisplayName, summarizeClusters } from "./ControlPanel";
import type { GraphNode, Layer } from "./types";

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    uuid: overrides.uuid ?? Math.random().toString(36).slice(2),
    type: "blob",
    name: "test",
    detail_url: "/blob/x/",
    degree: 1,
    community: null,
    ...overrides,
  };
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof ControlPanel>> = {}) {
  const props: React.ComponentProps<typeof ControlPanel> = {
    nodeCount: 12,
    edgeCount: 34,
    layers: new Set<Layer>(["direct", "tags"]),
    onToggleLayer: vi.fn(),
    nodes: [],
    communityLabels: {},
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

  it("hides the Clusters section when no nodes carry a community id", () => {
    renderPanel({ nodes: [makeNode({ community: null }), makeNode({ community: null })] });
    expect(screen.queryByText(/^Clusters$/i)).toBeNull();
  });

  it("renders one cluster row per distinct community plus an unclustered row", () => {
    renderPanel({
      nodes: [
        makeNode({ community: 0 }),
        makeNode({ community: 0 }),
        makeNode({ community: 1 }),
        makeNode({ community: null }),
      ],
    });
    expect(screen.getByText(/Cluster 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Cluster 2/i)).toBeInTheDocument();
    expect(screen.getByText(/^Unclustered$/i)).toBeInTheDocument();
  });

  it("renders TF-IDF cluster labels when supplied, falling back per-cluster", () => {
    renderPanel({
      nodes: [makeNode({ community: 0 }), makeNode({ community: 1 })],
      communityLabels: { "0": ["linux", "kernel"] },
    });
    // Cluster 0 has labels — joined with " · ".
    expect(screen.getByText(/linux · kernel/)).toBeInTheDocument();
    // Cluster 1 has none — generic fallback.
    expect(screen.getByText(/Cluster 2/i)).toBeInTheDocument();
  });
});

describe("clusterDisplayName", () => {
  it("returns 'Unclustered' for the null bucket", () => {
    expect(clusterDisplayName(null, {})).toBe("Unclustered");
  });

  it("joins labels with ' · ' when present", () => {
    expect(clusterDisplayName(0, { "0": ["linux", "kernel"] })).toBe("linux · kernel");
  });

  it("falls back to 'Cluster N+1' when labels are missing or empty", () => {
    expect(clusterDisplayName(0, {})).toBe("Cluster 1");
    expect(clusterDisplayName(3, { "3": [] })).toBe("Cluster 4");
  });
});

describe("summarizeClusters", () => {
  function n(community: number | null): GraphNode {
    return makeNode({ community });
  }

  it("returns an empty list for an empty node set", () => {
    expect(summarizeClusters([])).toEqual([]);
  });

  it("groups numeric communities and appends unclustered at the end", () => {
    const rows = summarizeClusters([n(0), n(0), n(1), n(null), n(null)]);
    expect(rows).toEqual([
      { community: 0, count: 2 },
      { community: 1, count: 1 },
      { community: null, count: 2 },
    ]);
  });

  it("omits the unclustered row when no nodes are unclustered", () => {
    const rows = summarizeClusters([n(0), n(0)]);
    expect(rows).toEqual([{ community: 0, count: 2 }]);
  });
});
