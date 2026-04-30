import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  doPost: vi.fn(),
}));

vi.mock("../utils/reactUtils", () => ({
  EventBus: { $emit: mocks.emit, $on: vi.fn(), $off: vi.fn() },
  doPost: (...args: unknown[]) => mocks.doPost(...args),
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
  mocks.doPost.mockReset();
});

describe("SongTable", () => {
  it("renders all 8 columns with headers", () => {
    render(
      <SongTable
        songs={songs}
        currentUuid={null}
        setRatingUrl="/r"
        songMediaUrl="/m"
        markListenedUrl="/l"
      />
    );
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("artist")).toBeInTheDocument();
    expect(screen.getByText("album")).toBeInTheDocument();
    expect(screen.getByText("Song One")).toBeInTheDocument();
    expect(screen.getByText("Album X")).toBeInTheDocument();
  });

  it("emits play-track when a row is clicked", () => {
    render(
      <SongTable
        songs={songs}
        currentUuid={null}
        setRatingUrl="/r"
        songMediaUrl="/m"
        markListenedUrl="/l"
      />
    );
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

  it("sets rating when a star is clicked", () => {
    render(
      <SongTable
        songs={songs}
        currentUuid={null}
        setRatingUrl="/r"
        songMediaUrl="/m"
        markListenedUrl="/l"
      />
    );
    const stars = screen.getAllByRole("button", { name: /set rating/i });
    fireEvent.click(stars[2]);
    expect(mocks.doPost).toHaveBeenCalledWith(
      "/r",
      expect.objectContaining({ uuid: "s1", rating: "3" }),
      expect.any(Function),
      expect.any(String)
    );
  });

  it("highlights the currently-playing row", () => {
    const { container } = render(
      <SongTable
        songs={songs}
        currentUuid="s1"
        setRatingUrl="/r"
        songMediaUrl="/m"
        markListenedUrl="/l"
      />
    );
    const playingRow = container.querySelector(".mlo-song-row-playing");
    expect(playingRow).not.toBeNull();
  });
});
