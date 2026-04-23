import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import NodeCard from "./NodeCard";
import type { NodeListItem } from "./types";

function makeNode(overrides: Partial<NodeListItem> = {}): NodeListItem {
  return {
    uuid: "uuid-1",
    name: "python",
    modified: "2026-04-15T12:00:00Z",
    collection_count: 2,
    todo_count: 1,
    pinned: false,
    ...overrides,
  };
}

const DETAIL_URL = "/node/uuid-1/";

describe("NodeCard", () => {
  it("renders the node name inside the card heading", () => {
    render(<NodeCard node={makeNode()} dense={false} detailUrl={DETAIL_URL} />);
    expect(screen.getByRole("heading", { name: "python" })).toBeInTheDocument();
  });

  it("links to the provided detail URL", () => {
    const { container } = render(
      <NodeCard node={makeNode()} dense={false} detailUrl={DETAIL_URL} />
    );
    const link = container.querySelector<HTMLAnchorElement>("a.nl-card");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe(DETAIL_URL);
  });

  it("shows the pinned indicator only when the node is pinned", () => {
    const { rerender } = render(
      <NodeCard node={makeNode({ pinned: false })} dense={false} detailUrl={DETAIL_URL} />
    );
    expect(screen.queryByTitle("pinned")).not.toBeInTheDocument();

    rerender(<NodeCard node={makeNode({ pinned: true })} dense={false} detailUrl={DETAIL_URL} />);
    expect(screen.getByTitle("pinned")).toBeInTheDocument();
  });

  it("adds the 'empty' class when the node has no collections and no todos", () => {
    const { container } = render(
      <NodeCard
        node={makeNode({ collection_count: 0, todo_count: 0 })}
        dense={false}
        detailUrl={DETAIL_URL}
      />
    );
    expect(container.querySelector("a.nl-card")?.className).toMatch(/\bempty\b/);
  });

  it("adds the 'dense' class when dense prop is true", () => {
    const { container } = render(<NodeCard node={makeNode()} dense detailUrl={DETAIL_URL} />);
    expect(container.querySelector("a.nl-card")?.className).toMatch(/\bdense\b/);
  });

  it("hides the sparkline in dense mode and shows it in grid mode", () => {
    const grid = render(<NodeCard node={makeNode()} dense={false} detailUrl={DETAIL_URL} />);
    expect(grid.container.querySelector("svg.nl-spark")).toBeInTheDocument();
    grid.unmount();

    const dense = render(<NodeCard node={makeNode()} dense detailUrl={DETAIL_URL} />);
    expect(dense.container.querySelector("svg.nl-spark")).not.toBeInTheDocument();
  });

  it("marks the collection count as 'zero' when there are none", () => {
    const { container } = render(
      <NodeCard
        node={makeNode({ collection_count: 0, todo_count: 1 })}
        dense={false}
        detailUrl={DETAIL_URL}
      />
    );
    const collDd = container.querySelector(".nl-stat:nth-of-type(1) .nl-num");
    expect(collDd?.className).toMatch(/\bzero\b/);
  });

  it("marks the todo count as 'hot' when greater than 2", () => {
    const { container } = render(
      <NodeCard node={makeNode({ todo_count: 5 })} dense={false} detailUrl={DETAIL_URL} />
    );
    const todoDd = container.querySelector(".nl-stat:nth-of-type(2) .nl-num");
    expect(todoDd?.className).toMatch(/\bhot\b/);
  });

  it("annotates the age label with the data-tone attribute", () => {
    const { container } = render(
      <NodeCard
        node={makeNode({ modified: "2022-04-15T12:00:00Z" })}
        dense={false}
        detailUrl={DETAIL_URL}
      />
    );
    const age = container.querySelector(".nl-age");
    expect(age?.getAttribute("data-tone")).toBe("archive");
    expect(age?.textContent).toContain("archive");
  });
});
