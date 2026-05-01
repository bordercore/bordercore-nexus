import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AlbumListPage from "./AlbumListPage";
import type { AlbumListAlbum } from "./types";

function makeAlbum(over: Partial<AlbumListAlbum> = {}): AlbumListAlbum {
  return {
    uuid: "a1",
    title: "Aenima",
    artist_name: "Tool",
    artist_uuid: "ar1",
    album_url: "/music/album/a1",
    artist_url: "/music/artist/ar1",
    artwork_url: "/img/a1.jpg",
    year: 1996,
    track_count: 15,
    ...over,
  };
}

const NAV = [..."abcdefghijklmnopqrstuvwxyz".split(""), "other"];

describe("AlbumListPage", () => {
  it("renders the cards for each album", () => {
    render(
      <AlbumListPage
        albums={[
          makeAlbum(),
          makeAlbum({ uuid: "a2", title: "Antichrist Superstar", artist_name: "Marilyn Manson" }),
        ]}
        nav={NAV}
        selectedLetter="a"
        uniqueAlbumLetters={["a", "b"]}
        albumListBaseUrl="/music/album_list"
        musicHomeUrl="/music/"
      />
    );
    expect(screen.getByText("Aenima")).toBeInTheDocument();
    expect(screen.getByText("Antichrist Superstar")).toBeInTheDocument();
    expect(screen.getByText("Tool")).toBeInTheDocument();
    expect(screen.getByText("Marilyn Manson")).toBeInTheDocument();
  });

  it("marks the selected letter as current and disables empty letters", () => {
    const { container } = render(
      <AlbumListPage
        albums={[]}
        nav={NAV}
        selectedLetter="a"
        uniqueAlbumLetters={["a", "b"]}
        albumListBaseUrl="/music/album_list"
        musicHomeUrl="/music/"
      />
    );
    const current = container.querySelector(".is-current");
    expect(current?.textContent).toBe("A");
    expect(container.querySelectorAll(".is-disabled").length).toBeGreaterThan(0);
  });

  it("shows an empty state when no albums are returned", () => {
    render(
      <AlbumListPage
        albums={[]}
        nav={NAV}
        selectedLetter="z"
        uniqueAlbumLetters={["a"]}
        albumListBaseUrl="/music/album_list"
        musicHomeUrl="/music/"
      />
    );
    expect(screen.getByText(/no albums starting with/i)).toBeInTheDocument();
  });

  it("links each letter that has albums", () => {
    const { container } = render(
      <AlbumListPage
        albums={[]}
        nav={NAV}
        selectedLetter="a"
        uniqueAlbumLetters={["a", "b"]}
        albumListBaseUrl="/music/album_list"
        musicHomeUrl="/music/"
      />
    );
    const bLink = Array.from(container.querySelectorAll(".mlo-letter-nav a")).find(
      el => el.textContent === "B"
    );
    expect(bLink?.getAttribute("href")).toBe("/music/album_list?letter=b");
  });
});
