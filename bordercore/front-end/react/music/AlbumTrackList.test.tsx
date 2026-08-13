import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { post: mocks.post },
}));

import AlbumTrackList from "./AlbumTrackList";
import type { Song, Playlist } from "./types";

const makeSong = (n: number, overrides: Partial<Song> = {}): Song =>
  ({
    uuid: `s${n}`,
    track: n,
    title: `Track ${n}`,
    raw_title: `Track ${n}`,
    note: "",
    rating: null,
    length_seconds: 180,
    length: "3:00",
    playlists: [],
    ...overrides,
  }) as Song;

const playlists: Playlist[] = [{ uuid: "p1", name: "Favorites" }];

const defaultProps = {
  currentSongUuid: null,
  isPlaying: false,
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

describe("AlbumTrackList", () => {
  it("renders zero-padded track numbers and durations", () => {
    render(<AlbumTrackList {...defaultProps} songs={[makeSong(1), makeSong(2)]} />);
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getAllByText("3:00")).toHaveLength(2);
  });

  it("splits tracks into two sequential columns, first half left", () => {
    const songs = [1, 2, 3, 4, 5].map(n => makeSong(n));
    const { container } = render(<AlbumTrackList {...defaultProps} songs={songs} />);
    const cols = container.querySelectorAll(".adp-tracklist-col");
    expect(cols).toHaveLength(2);
    // 5 tracks: 3 in the left column, 2 in the right
    expect(cols[0].querySelectorAll(".adp-track-row")).toHaveLength(3);
    expect(cols[1].querySelectorAll(".adp-track-row")).toHaveLength(2);
    expect(cols[0].textContent).toContain("Track 1");
    expect(cols[1].textContent).toContain("Track 4");
  });

  it("calls onSongClick when a row is clicked", () => {
    const onSongClick = vi.fn();
    const songs = [makeSong(1)];
    render(<AlbumTrackList {...defaultProps} songs={songs} onSongClick={onSongClick} />);
    fireEvent.click(screen.getByText("Track 1"));
    expect(onSongClick).toHaveBeenCalledWith(songs[0]);
  });

  it("does not trigger playback when a rating star is clicked", async () => {
    const onSongClick = vi.fn();
    const onRatingChange = vi.fn();
    const { container } = render(
      <AlbumTrackList
        {...defaultProps}
        songs={[makeSong(1)]}
        onSongClick={onSongClick}
        onRatingChange={onRatingChange}
      />
    );
    fireEvent.click(container.querySelectorAll(".rating")[2]);
    await vi.waitFor(() => expect(onRatingChange).toHaveBeenCalledWith("s1", 3));
    expect(onSongClick).not.toHaveBeenCalled();
  });

  it("marks the current track row and shows the equalizer animating", () => {
    const { container } = render(
      <AlbumTrackList
        {...defaultProps}
        songs={[makeSong(1), makeSong(2)]}
        currentSongUuid="s2"
        isPlaying={true}
      />
    );
    const current = container.querySelectorAll(".adp-track-row-current");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain("Track 2");
    expect(current[0].querySelector(".adp-eq")).not.toBeNull();
    expect(current[0].querySelector(".adp-eq-paused")).toBeNull();
  });

  it("freezes the equalizer when playback is paused", () => {
    const { container } = render(
      <AlbumTrackList
        {...defaultProps}
        songs={[makeSong(1)]}
        currentSongUuid="s1"
        isPlaying={false}
      />
    );
    expect(container.querySelector(".adp-eq-paused")).not.toBeNull();
  });

  it("renders the empty state when there are no tracks", () => {
    render(<AlbumTrackList {...defaultProps} songs={[]} />);
    expect(screen.getByText("no tracks on this album yet.")).toBeInTheDocument();
  });

  it("shows play count and last-played time in the row popup", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const { container } = render(
      <AlbumTrackList
        {...defaultProps}
        songs={[makeSong(1, { times_played: 3, last_time_played: twoDaysAgo })]}
      />
    );
    expect(container.querySelector(".play-stats-pop")?.textContent).toBe(
      "played 3 times · last 2d ago"
    );
  });

  it("uses singular phrasing for a single play", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { container } = render(
      <AlbumTrackList
        {...defaultProps}
        songs={[makeSong(1, { times_played: 1, last_time_played: oneHourAgo })]}
      />
    );
    expect(container.querySelector(".play-stats-pop")?.textContent).toBe(
      "played once · last 1h ago"
    );
  });

  it("shows never played for tracks with no plays", () => {
    const { container } = render(
      <AlbumTrackList
        {...defaultProps}
        songs={[makeSong(1, { times_played: 0, last_time_played: null })]}
      />
    );
    expect(container.querySelector(".play-stats-pop")?.textContent).toBe("never played");
  });

  it("links to the song edit page from the row menu", () => {
    const { container } = render(<AlbumTrackList {...defaultProps} songs={[makeSong(1)]} />);
    fireEvent.click(container.querySelector(".adp-track-menu .dropdown-trigger")!);
    const editLink = screen.getByText("Edit").closest("a");
    expect(editLink?.getAttribute("href")).toMatch(/^\/song\/s1\/edit/);
  });
});
