import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LibrarySidebar from "./LibrarySidebar";
import type { PlaylistSidebarItem } from "./types";

const playlists: PlaylistSidebarItem[] = [
  {
    uuid: "p1",
    name: "80s",
    num_songs: 12,
    url: "/music/playlist_detail/p1",
    type: "smart",
    parameters: { start_year: 1980, end_year: 1989 },
  },
  {
    uuid: "p2",
    name: "Mix",
    num_songs: 8,
    url: "/music/playlist_detail/p2",
    type: "manual",
  },
];

const navUrls = {
  albums: "/music/album_list",
  songs: "/music/",
  artists: "/music/artist/",
  tags: "/music/tag/",
};

const counts = { albums: 9, songs: 42, artists: 5, tags: 3 };

describe("LibrarySidebar", () => {
  it("renders the library nav and playlists", () => {
    render(
      <LibrarySidebar
        playlists={playlists}
        activePlaylistId={null}
        onSelectPlaylist={vi.fn()}
        onPlayPlaylist={vi.fn()}
        navUrls={navUrls}
        counts={counts}
      />
    );

    expect(screen.getByText(/overview/i)).toBeInTheDocument();
    expect(screen.getByText(/80s/)).toBeInTheDocument();
    expect(screen.getByText(/1980–1989/)).toBeInTheDocument();
    expect(screen.getByText(/Mix/)).toBeInTheDocument();
  });

  it("calls onSelectPlaylist on single click", () => {
    const onSelect = vi.fn();
    render(
      <LibrarySidebar
        playlists={playlists}
        activePlaylistId={null}
        onSelectPlaylist={onSelect}
        onPlayPlaylist={vi.fn()}
        navUrls={navUrls}
        counts={counts}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /80s/i }));
    expect(onSelect).toHaveBeenCalledWith("p1");
  });

  it("calls onPlayPlaylist on double click", () => {
    const onPlay = vi.fn();
    render(
      <LibrarySidebar
        playlists={playlists}
        activePlaylistId={null}
        onSelectPlaylist={vi.fn()}
        onPlayPlaylist={onPlay}
        navUrls={navUrls}
        counts={counts}
      />
    );

    fireEvent.doubleClick(screen.getByRole("button", { name: /Mix/i }));
    expect(onPlay).toHaveBeenCalledWith("p2");
  });

  it("marks the active playlist", () => {
    render(
      <LibrarySidebar
        playlists={playlists}
        activePlaylistId="p1"
        onSelectPlaylist={vi.fn()}
        onPlayPlaylist={vi.fn()}
        navUrls={navUrls}
        counts={counts}
      />
    );
    const row = screen.getByRole("button", { name: /80s/i });
    expect(row).toHaveAttribute("aria-current", "true");
  });
});
