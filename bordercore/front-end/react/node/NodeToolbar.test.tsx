import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import NodeToolbar from "./NodeToolbar";
import type { NodeSort } from "./types";

interface Overrides {
  q?: string;
  sort?: NodeSort;
  dense?: boolean;
  total?: number;
  showing?: number;
  setQ?: (q: string) => void;
  setSort?: (s: NodeSort) => void;
  setDense?: (d: boolean) => void;
}

function renderToolbar(overrides: Overrides = {}) {
  const setQ = overrides.setQ ?? vi.fn();
  const setSort = overrides.setSort ?? vi.fn();
  const setDense = overrides.setDense ?? vi.fn();
  const utils = render(
    <NodeToolbar
      q={overrides.q ?? ""}
      setQ={setQ}
      sort={overrides.sort ?? "modified"}
      setSort={setSort}
      dense={overrides.dense ?? false}
      setDense={setDense}
      total={overrides.total ?? 10}
      showing={overrides.showing ?? 10}
    />
  );
  return { ...utils, setQ, setSort, setDense };
}

describe("NodeToolbar", () => {
  it("fires setQ for each keystroke in the search input", async () => {
    const user = userEvent.setup();
    const { setQ } = renderToolbar();
    await user.type(screen.getByPlaceholderText(/filter nodes/i), "abc");
    expect(setQ).toHaveBeenCalledTimes(3);
    expect(setQ).toHaveBeenNthCalledWith(1, "a");
    expect(setQ).toHaveBeenNthCalledWith(2, "b");
    expect(setQ).toHaveBeenNthCalledWith(3, "c");
  });

  it("renders a clear button only when the query is non-empty", async () => {
    const user = userEvent.setup();
    const { rerender, setQ } = renderToolbar({ q: "" });
    expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();

    rerender(
      <NodeToolbar
        q="python"
        setQ={setQ}
        sort="modified"
        setSort={() => {}}
        dense={false}
        setDense={() => {}}
        total={10}
        showing={5}
      />
    );
    const clear = screen.getByRole("button", { name: /clear search/i });
    await user.click(clear);
    expect(setQ).toHaveBeenCalledWith("");
  });

  it("marks the active sort button with aria-pressed and the 'active' class", () => {
    renderToolbar({ sort: "name" });
    const name = screen.getByRole("button", { name: "name", pressed: true });
    expect(name.className).toMatch(/\bactive\b/);
    const modified = screen.getByRole("button", { name: "modified", pressed: false });
    expect(modified.className).not.toMatch(/\bactive\b/);
  });

  it("calls setSort with the chosen option", async () => {
    const user = userEvent.setup();
    const { setSort } = renderToolbar({ sort: "modified" });
    await user.click(screen.getByRole("button", { name: "collections" }));
    await user.click(screen.getByRole("button", { name: "todos" }));
    expect(setSort).toHaveBeenNthCalledWith(1, "coll");
    expect(setSort).toHaveBeenNthCalledWith(2, "todos");
  });

  it("toggles density via the grid/compact buttons", async () => {
    const user = userEvent.setup();
    const { setDense } = renderToolbar({ dense: false });
    await user.click(screen.getByRole("button", { name: /compact/i }));
    expect(setDense).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole("button", { name: /grid/i }));
    expect(setDense).toHaveBeenCalledWith(false);
  });

  it("marks the active view button with aria-pressed", () => {
    renderToolbar({ dense: true });
    expect(screen.getByRole("button", { name: /compact/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /grid/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows 'showing / total' counts", () => {
    const { container } = renderToolbar({ showing: 4, total: 12 });
    const count = container.querySelector(".nl-count");
    expect(count?.textContent).toMatch(/4/);
    expect(count?.textContent).toMatch(/12/);
  });
});
