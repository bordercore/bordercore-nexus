import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Search from "./Search";
import type { GraphNode } from "./types";

function makeNode(name: string, uuid = name): GraphNode {
  return {
    uuid,
    type: "blob",
    name,
    detail_url: `/blob/${uuid}/`,
    degree: 1,
    community: null,
  };
}

const NODES: GraphNode[] = [
  makeNode("Linux kernel notes", "uuid-linux"),
  makeNode("Python tricks", "uuid-python"),
  makeNode("PostgreSQL tuning", "uuid-pg"),
  makeNode("Rust ownership"),
];

describe("Search", () => {
  it("opens a dropdown of matches as the user types and picks on click", async () => {
    const onPick = vi.fn();
    render(<Search nodes={NODES} onPick={onPick} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/Search constellation/i), "lin");
    const option = await screen.findByRole("option", { name: /Linux kernel notes/i });
    await user.click(option);

    expect(onPick).toHaveBeenCalledWith("uuid-linux");
  });

  it("Enter picks the currently highlighted result", async () => {
    const onPick = vi.fn();
    render(<Search nodes={NODES} onPick={onPick} />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText(/Search constellation/i);
    await user.type(input, "py");
    await user.keyboard("{Enter}");

    expect(onPick).toHaveBeenCalledWith("uuid-python");
  });

  it("ArrowDown moves the highlight and Enter picks the new selection", async () => {
    const onPick = vi.fn();
    // Two nodes that both match "u" so we have a list to navigate.
    const nodes: GraphNode[] = [
      makeNode("Ubuntu setup", "uuid-ubuntu"),
      makeNode("Rust ownership", "uuid-rust"),
    ];
    render(<Search nodes={nodes} onPick={onPick} />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/Search constellation/i), "u");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onPick).toHaveBeenCalledWith("uuid-rust");
  });

  it("Escape clears the query when one is present", async () => {
    render(<Search nodes={NODES} onPick={vi.fn()} />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText(/Search constellation/i) as HTMLInputElement;
    await user.type(input, "lin");
    await user.keyboard("{Escape}");
    expect(input.value).toBe("");
  });

  it("does not show a dropdown for an empty query", () => {
    render(<Search nodes={NODES} onPick={vi.fn()} />);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
