import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import NodeSidebar from "./NodeSidebar";
import type { NodeFilter, NodeListItem } from "./types";

function makeNode(overrides: Partial<NodeListItem> = {}): NodeListItem {
  return {
    uuid: "u",
    name: "n",
    modified: "2026-04-15T12:00:00Z",
    collection_count: 0,
    todo_count: 0,
    pinned: false,
    ...overrides,
  };
}

const NODES: NodeListItem[] = [
  // 2026: pinned, has todos
  makeNode({ uuid: "a", name: "a", modified: "2026-02-01T12:00:00Z", pinned: true, todo_count: 3 }),
  // 2026: has a collection
  makeNode({ uuid: "b", name: "b", modified: "2026-01-01T12:00:00Z", collection_count: 2 }),
  // 2025: empty
  makeNode({ uuid: "c", name: "c", modified: "2025-05-10T12:00:00Z" }),
  // 2022: empty, archive
  makeNode({ uuid: "d", name: "d", modified: "2022-06-10T12:00:00Z" }),
];

interface Overrides {
  filter?: NodeFilter;
  onFilterChange?: (f: NodeFilter) => void;
  nodes?: NodeListItem[];
}

function renderSidebar(overrides: Overrides = {}) {
  const onFilterChange = overrides.onFilterChange ?? vi.fn();
  const utils = render(
    <NodeSidebar
      nodes={overrides.nodes ?? NODES}
      totalColl={2}
      totalTodo={3}
      filter={overrides.filter ?? { type: "all" }}
      onFilterChange={onFilterChange}
    />
  );
  return { ...utils, onFilterChange };
}

function sideItem(label: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${label}`, "i") });
}

describe("NodeSidebar", () => {
  it("renders counts for the built-in views", () => {
    renderSidebar();
    // "all nodes" includes the count badge; match against the full button text.
    expect(sideItem("all nodes").textContent).toContain("4");
    expect(sideItem("pinned").textContent).toContain("1");
    expect(sideItem("with todos").textContent).toContain("1");
    expect(sideItem("empty").textContent).toContain("2");
    expect(sideItem("archive").textContent).toContain("1");
  });

  it("groups nodes by year, sorted descending", () => {
    renderSidebar();
    // Collect all year buttons (their labels are 4-digit years).
    const buttons = screen.getAllByRole("button");
    const yearLabels = buttons
      .map(b => within(b).queryByText(/^\d{4}$/)?.textContent)
      .filter((t): t is string => !!t);
    expect(yearLabels).toEqual(["2026", "2025", "2022"]);
  });

  it("marks the active filter button with aria-current and the 'active' class", () => {
    renderSidebar({ filter: { type: "pinned" } });
    const pinned = sideItem("pinned");
    expect(pinned).toHaveAttribute("aria-current", "true");
    expect(pinned.className).toMatch(/\bactive\b/);

    const all = sideItem("all nodes");
    expect(all).not.toHaveAttribute("aria-current");
  });

  it("calls onFilterChange with the clicked filter", async () => {
    const user = userEvent.setup();
    const { onFilterChange } = renderSidebar();
    await user.click(sideItem("pinned"));
    await user.click(sideItem("with todos"));
    await user.click(sideItem("archive"));
    expect(onFilterChange).toHaveBeenNthCalledWith(1, { type: "pinned" });
    expect(onFilterChange).toHaveBeenNthCalledWith(2, { type: "with-todos" });
    expect(onFilterChange).toHaveBeenNthCalledWith(3, { type: "archive" });
  });

  it("emits a year filter when a year button is clicked", async () => {
    const user = userEvent.setup();
    const { onFilterChange } = renderSidebar();
    const btn2025 = screen.getAllByRole("button").find(b => within(b).queryByText("2025"));
    expect(btn2025).toBeDefined();
    await user.click(btn2025!);
    expect(onFilterChange).toHaveBeenCalledWith({ type: "year", year: 2025 });
  });

  it("shows the totals block", () => {
    const { container } = renderSidebar();
    const totals = container.querySelector(".nl-totals");
    expect(totals?.textContent).toContain("collections");
    expect(totals?.textContent).toContain("2");
    expect(totals?.textContent).toContain("todos");
    expect(totals?.textContent).toContain("3");
    // "fresh" counts nodes modified in 2026 or later — two of our fixtures.
    expect(container.querySelector(".nl-total-fresh")?.textContent).toContain("2");
  });
});
