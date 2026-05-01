import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AlbumGridCard from "./AlbumGridCard";
import type { RecentAlbum } from "./types";

const album: RecentAlbum = {
  uuid: "a1",
  title: "The Album",
  artist_uuid: "ar1",
  artist_name: "Artist Name",
  created: "January 2024",
  album_url: "/music/album/a1",
  artwork_url: "/img/a1.jpg",
  artist_url: "/music/artist/ar1",
  year: 1985,
  original_release_year: 1985,
  track_count: 12,
  playtime: "47:00",
  tags: ["synthwave", "ambient"],
  rating: 4,
  plays: 22,
};

describe("AlbumGridCard", () => {
  it("renders title, artist, year, plays, and tags", () => {
    render(<AlbumGridCard album={album} onPlay={vi.fn()} />);
    expect(screen.getByText("The Album")).toBeInTheDocument();
    expect(screen.getByText("Artist Name")).toBeInTheDocument();
    expect(screen.getByText("1985")).toBeInTheDocument();
    expect(screen.getByText("♪22")).toBeInTheDocument();
    expect(screen.getByText("#synthwave")).toBeInTheDocument();
    expect(screen.getByText("#ambient")).toBeInTheDocument();
  });

  it("calls onPlay when the play button is clicked", () => {
    const onPlay = vi.fn();
    render(<AlbumGridCard album={album} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole("button", { name: /play album/i }));
    expect(onPlay).toHaveBeenCalledWith(album);
  });
});
