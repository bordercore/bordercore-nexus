import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PageHead from "./PageHead";

describe("PageHead", () => {
  it("renders the title", () => {
    render(
      <PageHead
        searchValue=""
        onSearchChange={vi.fn()}
        onShuffleAll={vi.fn()}
        createSongUrl="/music/songs/new"
        createAlbumUrl="/music/albums/new"
        onCreatePlaylist={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: /Library/i })).toBeInTheDocument();
  });

  it("calls onSearchChange when typing", () => {
    const onChange = vi.fn();
    render(
      <PageHead
        searchValue=""
        onSearchChange={onChange}
        onShuffleAll={vi.fn()}
        createSongUrl="/music/songs/new"
        createAlbumUrl="/music/albums/new"
        onCreatePlaylist={vi.fn()}
      />
    );
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "abba" } });
    expect(onChange).toHaveBeenCalledWith("abba");
  });

  it("focuses the search input on Cmd+K", () => {
    render(
      <PageHead
        searchValue=""
        onSearchChange={vi.fn()}
        onShuffleAll={vi.fn()}
        createSongUrl="/music/songs/new"
        createAlbumUrl="/music/albums/new"
        onCreatePlaylist={vi.fn()}
      />
    );
    const input = screen.getByPlaceholderText(/search/i);
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(input);
  });
});
