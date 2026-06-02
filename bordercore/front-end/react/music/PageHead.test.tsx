import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PageHead from "./PageHead";

describe("PageHead", () => {
  const baseProps = {
    onShuffleAll: vi.fn(),
    createSongUrl: "/music/songs/new",
    createAlbumUrl: "/music/albums/new",
    onCreatePlaylist: vi.fn(),
  };

  it("renders the title", () => {
    render(<PageHead {...baseProps} />);
    expect(screen.getByRole("heading", { name: /Library/i })).toBeInTheDocument();
  });

  it("renders the shuffle-all action", () => {
    render(<PageHead {...baseProps} />);
    expect(screen.getByText(/shuffle all/i)).toBeInTheDocument();
  });
});
