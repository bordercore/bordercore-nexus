import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SearchModeNav, type SearchMode } from "./SearchModeNav";

const MODE_LABELS: Record<SearchMode, string> = {
  term: "Term Search",
  tag: "Tag Search",
  semantic: "Semantic Search",
};

describe("SearchModeNav", () => {
  it("renders all three mode buttons", () => {
    render(<SearchModeNav activeMode="term" onModeChange={() => {}} />);
    for (const label of Object.values(MODE_LABELS)) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("marks only the active mode button with the 'active' class", () => {
    render(<SearchModeNav activeMode="tag" onModeChange={() => {}} />);
    const tag = screen.getByRole("button", { name: /Tag Search/ });
    const term = screen.getByRole("button", { name: /Term Search/ });
    const semantic = screen.getByRole("button", { name: /Semantic Search/ });

    expect(tag.className).toMatch(/\bactive\b/);
    expect(term.className).not.toMatch(/\bactive\b/);
    expect(semantic.className).not.toMatch(/\bactive\b/);
  });

  it.each<[SearchMode, string]>([
    ["term", "Term Search"],
    ["tag", "Tag Search"],
    ["semantic", "Semantic Search"],
  ])("invokes onModeChange with %s when its button is clicked", async (mode, label) => {
    const onModeChange = vi.fn();
    const user = userEvent.setup();

    render(<SearchModeNav activeMode="term" onModeChange={onModeChange} />);
    await user.click(screen.getByRole("button", { name: new RegExp(label) }));

    expect(onModeChange).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith(mode);
  });
});
