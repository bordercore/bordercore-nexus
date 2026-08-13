import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  post: vi.fn(),
}));

vi.mock("../utils/reactUtils", () => ({
  EventBus: { $emit: mocks.emit, $on: vi.fn(), $off: vi.fn() },
  doDelete: vi.fn(),
  getCsrfToken: () => "tok",
}));

vi.mock("axios", () => ({
  default: { post: mocks.post },
}));

vi.mock("./EditAlbumModal", async () => {
  const React = await import("react");
  return { default: React.forwardRef(() => null) };
});

import AlbumDetailPage from "./AlbumDetailPage";
import type { Album, Song, AlbumDetailUrls, Playlist } from "./types";

const album: Album = {
  uuid: "a1",
  title: "Forever",
  artist_name: "Charly Bliss",
  artist_uuid: "ar1",
  year: 2024,
  original_release_year: null,
  playtime: "37 min",
  cover_url: "/media/cover.jpg",
  note: "A **great** album",
  tags: ["power-pop"],
  has_songs: true,
};

const makeSong = (n: number, rating: number | null, playlists: string[] = []): Song =>
  ({
    uuid: `s${n}`,
    track: n,
    title: `Track ${n}`,
    raw_title: `Track ${n}`,
    note: "",
    rating,
    length_seconds: 180,
    length: "3:00",
    playlists,
  }) as Song;

const songs: Song[] = [makeSong(1, 4), makeSong(2, 5), makeSong(3, null)];

const playlists: Playlist[] = [{ uuid: "p1", name: "Favorites" }];

const urls: AlbumDetailUrls = {
  setSongRating: "/rate",
  getPlaylists: "/playlists",
  addToPlaylist: "/playlist/add",
  markListenedTo: "/listened",
  updateAlbum: "/album/update",
  searchArtists: "/artists/search",
  searchTags: "/tags/search",
  editSong: "/song/00000000-0000-0000-0000-000000000000/edit",
  songMedia: "/media/songs/",
  deleteAlbum: "/album/delete",
  musicList: "/music",
  artistDetail: "/music/artist/ar1",
};

const defaultProps = {
  album,
  songs,
  initialTags: [],
  playlists,
  urls,
  staticUrl: "/static/",
  defaultPlaylist: "",
};

beforeEach(() => {
  mocks.emit.mockReset();
  mocks.post.mockReset();
  mocks.post.mockResolvedValue({ data: { action: "added" } });
});

describe("AlbumDetailPage", () => {
  it("renders the hero: title, artist link, eyebrow, and blurred art wash", () => {
    const { container } = render(<AlbumDetailPage {...defaultProps} />);
    expect(screen.getByText("Forever")).toBeInTheDocument();
    const artistLink = screen.getByText("Charly Bliss").closest("a");
    expect(artistLink?.getAttribute("href")).toBe("/music/artist/ar1");
    expect(screen.getByText("album · in your library")).toBeInTheDocument();
    expect(container.querySelector(".adp-hero-art")).not.toBeNull();
  });

  it("computes the meta row live from song ratings", () => {
    render(<AlbumDetailPage {...defaultProps} />);
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("3 tracks")).toBeInTheDocument();
    expect(screen.getByText("37 min")).toBeInTheDocument();
    // ratings 4 and 5 → average 4.5, 2 rated
    expect(screen.getByText("4.5 avg · 2 rated")).toBeInTheDocument();
  });

  it("omits the rating segment when no tracks are rated", () => {
    render(<AlbumDetailPage {...defaultProps} songs={[makeSong(1, null)]} />);
    expect(screen.queryByText(/avg ·/)).toBeNull();
  });

  it("skips the art wash when the album has no artwork", () => {
    const { container } = render(
      <AlbumDetailPage {...defaultProps} album={{ ...album, cover_url: "" }} />
    );
    expect(container.querySelector(".adp-hero-art")).toBeNull();
  });

  it("plays the first track when play album is clicked", () => {
    render(<AlbumDetailPage {...defaultProps} />);
    fireEvent.click(screen.getByText("play album"));
    expect(mocks.emit).toHaveBeenCalledWith(
      "play-track",
      expect.objectContaining({
        track: expect.objectContaining({ uuid: "s1" }),
      })
    );
  });

  it("plays some album track when shuffle is clicked", () => {
    render(<AlbumDetailPage {...defaultProps} />);
    fireEvent.click(screen.getByText("shuffle"));
    const call = mocks.emit.mock.calls.find(c => c[0] === "play-track");
    expect(call).toBeDefined();
    expect(songs.map(s => s.uuid)).toContain(call![1].track.uuid);
  });

  it("adds only songs not already in the playlist when adding the album", async () => {
    const withMembership = [makeSong(1, null, ["p1"]), makeSong(2, null)];
    render(<AlbumDetailPage {...defaultProps} songs={withMembership} />);
    fireEvent.click(screen.getByText("playlist"));
    fireEvent.click(screen.getByText("Favorites"));
    await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    const body = mocks.post.mock.calls[0][1] as URLSearchParams;
    expect(body.get("song_uuid")).toBe("s2");
    expect(body.get("playlist_uuid")).toBe("p1");
  });

  it("renders the album note as markdown and the tags", () => {
    const { container } = render(<AlbumDetailPage {...defaultProps} />);
    expect(container.querySelector(".adp-note strong")?.textContent).toBe("great");
    expect(screen.getByText("power-pop")).toBeInTheDocument();
  });

  it("opens a fullscreen view of the cover art when clicked", () => {
    render(<AlbumDetailPage {...defaultProps} />);
    expect(document.querySelector(".bd-image-lightbox")).toBeNull();
    fireEvent.click(screen.getByAltText("Forever cover"));
    const lightboxImg = document.querySelector(".bd-image-lightbox-img");
    expect(lightboxImg?.getAttribute("src")).toBe("/media/cover.jpg");
  });

  it("closes the fullscreen cover view on Escape", () => {
    render(<AlbumDetailPage {...defaultProps} />);
    fireEvent.click(screen.getByAltText("Forever cover"));
    expect(document.querySelector(".bd-image-lightbox")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".bd-image-lightbox")).toBeNull();
  });

  it("shows the original release year when it differs", () => {
    render(<AlbumDetailPage {...defaultProps} album={{ ...album, original_release_year: 1994 }} />);
    expect(screen.getByText(/originally released 1994/)).toBeInTheDocument();
  });
});
