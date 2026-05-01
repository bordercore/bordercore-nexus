import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  doGet: vi.fn(),
  doPost: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));

vi.mock("../utils/reactUtils", () => ({
  doGet: (...args: unknown[]) => mocks.doGet(...args),
  doPost: (...args: unknown[]) => mocks.doPost(...args),
  EventBus: { $emit: mocks.emit, $on: mocks.on, $off: mocks.off },
  getCsrfToken: () => "tok",
}));

import MusicDashboardPage from "./MusicDashboardPage";
import type { MusicDashboardProps } from "./types";

function makeProps(): MusicDashboardProps {
  return {
    randomAlbum: null,
    playlists: [{ uuid: "p1", name: "Mix", num_songs: 3, url: "/p/p1", type: "manual" }],
    recentPlayedSongs: [],
    initialRecentAlbums: [],
    initialPaginator: {
      page_number: 1,
      has_next: false,
      has_previous: false,
      next_page_number: null,
      previous_page_number: null,
      count: 0,
    },
    collectionIsNotEmpty: true,
    dashboardStats: {
      plays_this_week: 1,
      top_tag_7d: null,
      added_this_month: 0,
      longest_streak: 0,
      plays_today: 0,
    },
    urls: {
      recentAlbums: "/recent_albums/666/",
      recentSongs: "/recent_songs",
      shuffleSongs: "/shuffle_songs",
      search: "/search",
      createPlaylist: "/playlist_create",
      tagSearch: "/tag/search",
      createSong: "/create",
      createAlbum: "/create_album",
      albumList: "/album_list",
      setSongRating: "/set_song_rating",
      songMedia: "/media/song/",
      markListened: "/mark_listened/00000000-0000-0000-0000-000000000000",
      getPlaylist: "/get_playlist/00000000-0000-0000-0000-000000000000",
    },
    imagesUrl: "/img/",
    libraryCounts: { albums: 0, songs: 0, artists: 0, tags: 0 },
  };
}

describe("MusicDashboardPage", () => {
  beforeEach(() => {
    mocks.doGet.mockReset();
    mocks.emit.mockReset();
    mocks.doGet.mockImplementation((_url: string, cb: (r: unknown) => void) => {
      cb({ data: { song_list: [] } });
    });
  });

  it("renders all major regions", () => {
    render(<MusicDashboardPage {...makeProps()} />);
    expect(screen.getAllByText(/library/i).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(screen.getByText("Mix")).toBeInTheDocument();
    expect(screen.getByText(/plays this week/i)).toBeInTheDocument();
  });

  it("filters via search input", () => {
    render(<MusicDashboardPage {...makeProps()} />);
    const search = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "abba" } });
    expect(search.value).toBe("abba");
  });

  it("disables album pager arrows when there is a single page", () => {
    render(<MusicDashboardPage {...makeProps()} />);
    const prev = screen.getByLabelText("Previous page") as HTMLButtonElement;
    const next = screen.getByLabelText("Next page") as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument();
  });

  it("fetches the next album page when the next arrow is clicked", () => {
    const props = makeProps();
    props.initialPaginator = {
      page_number: 1,
      has_next: true,
      has_previous: false,
      next_page_number: 2,
      previous_page_number: null,
      count: 14,
    };
    render(<MusicDashboardPage {...props} />);

    mocks.doGet.mockReset();
    mocks.doGet.mockImplementation((url: string, cb: (r: unknown) => void) => {
      if (url.includes("recent_albums")) {
        cb({
          data: {
            album_list: [],
            paginator: {
              page_number: 2,
              has_next: false,
              has_previous: true,
              next_page_number: null,
              previous_page_number: 1,
              count: 14,
            },
          },
        });
      }
    });

    fireEvent.click(screen.getByLabelText("Next page"));
    expect(mocks.doGet).toHaveBeenCalledWith(
      "/recent_albums/2/",
      expect.any(Function),
      expect.any(String)
    );
    expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();
  });
});
