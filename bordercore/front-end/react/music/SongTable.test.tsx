import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
}));

vi.mock("../utils/reactUtils", () => ({
  EventBus: { $emit: mocks.emit, $on: vi.fn(), $off: vi.fn() },
  getCsrfToken: () => "tok",
}));

import SongTable from "./SongTable";
import type { RecentAddedSong } from "./types";

const songs: RecentAddedSong[] = [
  {
    uuid: "s1",
    title: "Song One",
    artist: "Artist A",
    year: 1985,
    length: "3:30",
    artist_url: "/music/artist/a",
    album_title: "Album X",
    rating: 4,
    plays: 10,
  },
  {
    uuid: "s2",
    title: "Song Two",
    artist: "Artist B",
    year: 1990,
    length: "4:10",
    artist_url: "/music/artist/b",
    album_title: null,
    rating: null,
    plays: 0,
  },
];

beforeEach(() => {
  mocks.emit.mockReset();
});

describe("SongTable", () => {
  it("renders the columns and song rows", () => {
    render(<SongTable songs={songs} currentUuid={null} songMediaUrl="/m" markListenedUrl="/l" />);
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("artist")).toBeInTheDocument();
    expect(screen.getByText("Song One")).toBeInTheDocument();
  });

  it("emits play-track when a row is clicked", () => {
    render(<SongTable songs={songs} currentUuid={null} songMediaUrl="/m" markListenedUrl="/l" />);
    fireEvent.click(screen.getByText("Song Two"));
    expect(mocks.emit).toHaveBeenCalledWith(
      "play-track",
      expect.objectContaining({
        track: expect.objectContaining({ uuid: "s2" }),
        trackList: songs,
        songUrl: "/m",
        markListenedToUrl: "/l",
      })
    );
  });

  it("highlights the currently-playing row", () => {
    const { container } = render(
      <SongTable songs={songs} currentUuid="s1" songMediaUrl="/m" markListenedUrl="/l" />
    );
    const playingRow = container.querySelector(".mlo-song-row-playing");
    expect(playingRow).not.toBeNull();
  });

  it("shows play stats in the row popup", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const withStats = [{ ...songs[0], times_played: 10, last_time_played: threeDaysAgo }];
    const { container } = render(
      <SongTable songs={withStats} currentUuid={null} songMediaUrl="/m" markListenedUrl="/l" />
    );
    expect(container.querySelector(".play-stats-pop")?.textContent).toBe(
      "played 10 times · last 3d ago"
    );
  });

  it("shows never played for songs with no plays", () => {
    const { container } = render(
      <SongTable songs={[songs[1]]} currentUuid={null} songMediaUrl="/m" markListenedUrl="/l" />
    );
    expect(container.querySelector(".play-stats-pop")?.textContent).toBe("never played");
  });
});
