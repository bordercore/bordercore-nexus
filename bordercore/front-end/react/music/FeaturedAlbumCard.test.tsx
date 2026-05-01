import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
  it("renders the album with title, artist, and section heading", () => {
    render(<FeaturedAlbumCard album={album} />);
    expect(screen.getByText("Featured Album")).toBeInTheDocument();
    expect(screen.getByText("Featured Title")).toBeInTheDocument();
    expect(screen.getByText("Featured Artist")).toBeInTheDocument();
  });
});
