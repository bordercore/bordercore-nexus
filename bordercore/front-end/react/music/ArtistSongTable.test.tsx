import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { post: mocks.post },
}));

import { ArtistSongTable } from "./ArtistSongTable";
import type { ArtistSong, Playlist } from "./types";

const makeSong = (n: number, overrides: Partial<ArtistSong> = {}): ArtistSong => ({
  uuid: `s${n}`,
  title: `Song ${n}`,
  note: "",
  rating: null,
  length: "3:00",
  year_effective: 1994,
  artist: "Artist A",
  playlists: [],
  ...overrides,
});

const playlists: Playlist[] = [{ uuid: "p1", name: "Favorites" }];

const defaultProps = {
  currentSongUuid: null,
  isPlaying: false,
  staticUrl: "/static/",
  setSongRatingUrl: "/rate",
  editSongUrlTemplate: "/song/00000000-0000-0000-0000-000000000000/edit",
  addToPlaylistUrl: "/playlist/add",
  playlists,
  onSongClick: () => {},
  onRatingChange: () => {},
  onPlaylistToggle: () => {},
};

beforeEach(() => {
  mocks.post.mockReset();
  mocks.post.mockResolvedValue({ data: {} });
});

describe("ArtistSongTable", () => {
  it("renders song rows and plays on title click", () => {
    const onSongClick = vi.fn();
    const songs = [makeSong(1), makeSong(2)];
    render(<ArtistSongTable {...defaultProps} songs={songs} onSongClick={onSongClick} />);
    expect(screen.getByText("Song 2")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Song 1"));
    expect(onSongClick).toHaveBeenCalledWith(songs[0]);
  });

  it("shows play stats in the row popup", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const { container } = render(
      <ArtistSongTable
        {...defaultProps}
        songs={[makeSong(1, { times_played: 6, last_time_played: twoDaysAgo })]}
      />
    );
    const row = container.querySelector("tbody tr");
    expect(row?.classList.contains("play-stats-row")).toBe(true);
    expect(row?.querySelector(".play-stats-pop")?.textContent).toBe("played 6 times · last 2d ago");
  });

  it("shows never played for songs with no plays", () => {
    const { container } = render(<ArtistSongTable {...defaultProps} songs={[makeSong(1)]} />);
    expect(container.querySelector(".play-stats-pop")?.textContent).toBe("never played");
  });
});
