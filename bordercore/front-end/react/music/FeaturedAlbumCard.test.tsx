import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import FeaturedAlbumCard from "./FeaturedAlbumCard";
import type { FeaturedAlbum } from "./types";

const album: FeaturedAlbum = {
  uuid: "f1",
  title: "Featured Title",
  artist_name: "Featured Artist",
  artist_uuid: "fa",
  album_url: "/album/f1",
  artist_url: "/artist/fa",
  artwork_url: "/img/f1.jpg",
};

describe("FeaturedAlbumCard", () => {
  it("renders the album with play and shuffle buttons", () => {
    render(<FeaturedAlbumCard album={album} onPlay={vi.fn()} onShuffle={vi.fn()} />);
    expect(screen.getByText("Featured Title")).toBeInTheDocument();
    expect(screen.getByText("Featured Artist")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /shuffle/i })).toBeInTheDocument();
  });

  it("calls handlers", () => {
    const play = vi.fn();
    const shuffle = vi.fn();
    render(<FeaturedAlbumCard album={album} onPlay={play} onShuffle={shuffle} />);
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    fireEvent.click(screen.getByRole("button", { name: /shuffle/i }));
    expect(play).toHaveBeenCalled();
    expect(shuffle).toHaveBeenCalled();
  });
});
