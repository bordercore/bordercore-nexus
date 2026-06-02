import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import MusicToolbar from "./MusicToolbar";

describe("MusicToolbar", () => {
  it("calls onSearchChange when typing", () => {
    const onChange = vi.fn();
    render(<MusicToolbar searchValue="" onSearchChange={onChange} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "abba" } });
    expect(onChange).toHaveBeenCalledWith("abba");
  });

  it("focuses the search input on Cmd+K", () => {
    render(<MusicToolbar searchValue="" onSearchChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(input);
  });

  it("renders the palette slot when provided", () => {
    render(
      <MusicToolbar
        searchValue="ab"
        onSearchChange={vi.fn()}
        paletteSlot={<div data-testid="palette" />}
      />
    );
    expect(screen.getByTestId("palette")).toBeInTheDocument();
  });
});
