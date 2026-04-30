# Music Library OS — dashboard redesign

Reference: `design_handoff_music_library_os/README.md` (visual spec, full‑fidelity).
Status: design approved 2026‑04‑30; user opted to skip section‑by‑section review.

## Goal

Replace the current `/music/` dashboard (`MusicDashboardPage`) with the Library OS
design from the handoff. Keep the page mounted under `base.html` (global topbar +
sidebar stay), reuse the existing `GlobalAudioPlayer` (react‑jinke‑music‑player)
for playback, and add the small server‑side aggregations the design's stat strip
needs. No router changes, no new pages — the four library‑nav links route out to
the existing music pages.

## Decisions (from brainstorming)

1. **Mounting** — replace in place at `/music/` (`music:list`). Page stays inside
   `base.html`; no full‑viewport shell.
2. **Topbar from the design** — drop the avatar/global meta. Keep a slim
   page‑local bar with a breadcrumb (`/bordercore/music/library`) and the ⌘K live
   search input.
3. **Now‑playing bar from the design** — drop. Keep `GlobalAudioPlayer` as is.
   Dashboard interactions (row click, album play, playlist double‑click) emit the
   existing `play-track` EventBus signal.
4. **Sidebar library nav** — five items: overview, albums, songs, artists, tags.
   "Overview" stays on the dashboard. The other four are anchor links to the
   existing pages (`/music/album_list`, `/music/`, `/music/artist/...`,
   `/music/tag/`). Playlist clicks filter the dashboard in place; double‑click
   plays via `GlobalAudioPlayer`.
5. **Stat strip + Featured** — ship all five cells via small server‑side
   aggregations on `Listen`. Featured stays "random album of load" but uses the
   "album of the week" label.

## Architecture

### React layer

Rebuild `MusicDashboardPage.tsx` as the new layout. New focused components live
beside it under `front-end/react/music/`:

- `LibrarySidebar.tsx` — 240px sidebar: library‑nav anchors with icon + count;
  playlists section with smart‑playlist query‑expression line, color dot, active
  state. Single click → filter; double click → play.
- `StatStrip.tsx` — 5 cells with hairline dividers. "Now playing" subscribes to
  `EventBus` `audio-play`/`audio-pause` to drive the pulsing dot.
- `PageHead.tsx` — h1 + meta subhead + slim breadcrumb/search. ⌘K binds at
  window level (cleanup on unmount). Search value lifts to dashboard state.
- `AlbumGridCard.tsx` — 4‑column album grid. Hover gradient overlay + 38px play
  button (CSS `:hover`, no JS). Bottom‑right pill `{tracks}t · {playtime}`. Title
  / artist / meta row / tag chips.
- `SongTable.tsx` (overview) — 8‑col grid: `# | title | artist | album | ★ | ♪ |
  year | length`. Stars are inline‑editable (existing `set_song_rating`).
  Row click plays via `EventBus`. Currently‑playing row shows accent tint + left
  rail + volume‑high icon (subscribes to `audio-play`).
- `FeaturedAlbumCard.tsx` — keep file name, replace innards: 224×224 cover,
  reskinned chrome, play / shuffle buttons.
- `RecentPlaysCard.tsx` — replaces `RecentlyPlayedSongsCard` rendering with the
  numbered‑list visual.

Shared utilities reused as is: `GlobalAudioPlayer`, `StarRating`, `EventBus`,
`reactUtils`, `CreatePlaylistModal`, `AddToPlaylistModal`.

### State

Centralized in `MusicDashboardPage`:

```ts
search: string;
activePlaylistId: string | null;
playlistSongs: PlaylistSong[] | null;   // only when filtering
currentlyPlayingUuid: string | null;    // mirrors EventBus
```

Search filters the album grid + song table client‑side (case‑insensitive
substring on title/artist/album/tags). When `activePlaylistId` is set, the album
grid hides and the song table shows the playlist's songs (fetched via
`get_playlist`). `currentlyPlayingUuid` is updated by an `audio-play` listener.

### Server changes

#### `music_list` view (`bordercore/music/views.py:63`)

Extend the existing render with a new `dashboard_stats` payload:

```py
{
    "plays_this_week":   int,
    "top_tag_7d":        {"name": str, "count": int} | None,
    "added_this_month":  int,                          # albums created this month
    "longest_streak":    int,                          # consecutive days with ≥1 listen
    "plays_today":       int,
}
```

Implementation in `music/services.py` as `get_dashboard_stats(user)`:

- `plays_this_week`: `Listen.objects.filter(user=u, created__gte=now-7d).count()`
- `top_tag_7d`: aggregate over recent listens → song.tags → name, ordered by
  count, top 1. Returns None if no listens.
- `added_this_month`: `Album.objects.filter(user=u, created__gte=start_of_month).count()`
- `longest_streak`: longest run of consecutive calendar days that contain at
  least one `Listen` for this user, anywhere in history (not just the current
  trailing streak). Implementation: `SELECT DISTINCT created::date` ordered ASC,
  walk in Python, track max consecutive‑day run. Single query.
- `plays_today`: `Listen.objects.filter(user=u, created__date=today).count()`

Serialized as JSON, attached to the existing `data-*` attributes block on
`#react-root`. No new endpoint.

#### `recent_albums` data extension

Extend `services.get_recent_albums` so each album dict also carries:

- `track_count: int` — `Song.objects.filter(album=a).count()` (annotated)
- `playtime: str` — humanized total from `Sum('length')` (annotated)
- `tags: list[str]` — first 2 tag names (`album.tags.values_list('name', flat=True)`,
  prefetched)
- `year: int | None`, `original_release_year: int | None` (already on Album)
- `rating: int | None` — `Avg('song__rating')` rounded; `None` if no rated songs
- `plays: int` — `Count('song__listen')` (Listen rows linked through the album's
  songs). `Song` has no `plays` field; play counts come from the `Listen` table.

These are all annotations on the existing `Album` queryset; one query with
`prefetch_related('tags')` and `annotate(...)`.

#### `recent_songs` endpoint extension

`RecentSongsListView` already returns `song_list`. Extend each item to carry
`album_title`, `rating`, and `plays` (the latter is `Count('listen')` on
`Song`, since there's no denormalized counter) so the song table can render the
design's columns without an extra round‑trip.

### Smart playlist filtering

Click on a sidebar playlist:

1. Set `activePlaylistId` and update breadcrumb segment in `PageHead`.
2. Fetch via existing `GET /music/get_playlist/<uuid>` (returns
   `playlistitems`).
3. Render those songs in the song table; hide the album grid; hide the
   "Recently Added Songs" section header (the table now represents the playlist).

Empty‑state copy: `no songs match the current filters`.

Double‑click: same fetch, then emit `play-track` with the resulting list as
`trackList` and the first song as `track`.

### Smart playlist query‑expression line

Pure render of `Playlist.parameters` JSON. Format mirrors the README:

| Field | Render |
|---|---|
| `tag` | `tag:{value}` |
| `rating` | `★{n}` |
| `start_year` + `end_year` | `{start}–{end}` |
| `exclude_albums: true` | `¬album` |
| `exclude_recent: n` | `¬{n}d` |
| `sort_by: "random"` | `↻random` |

Joined with ` · ` between non‑empty parts. Lives in a small pure helper
`describeSmartPlaylist(parameters)`.

### Color dot for playlists

`Playlist` has no color field. We derive a stable hue from the playlist UUID
(hash → HSL) for the 7×7 dot. No migration.

## Styling

New file: `static/scss/pages/_music-library-os.scss`, namespaced under a single
top‑level class `.music-library-os` to avoid bleed into `_music.scss`.

- Use Bordercore's existing CSS custom properties where they exist; introduce
  new vars only where the design's tokens (`--bc-*`) don't have an equivalent.
  Map names: `--bc-accent → var(--accent)`, etc. Keep token names readable —
  prefix new ones with `--mlo-` (music library OS).
- Fonts: Inter, JetBrains Mono, Space Grotesk are already used elsewhere
  (`_drill-refined.scss`, `_theme-dark.scss`). Reuse the same `@font-face` /
  `--font-ui` / `--font-mono` variables.
- Icons: existing FontAwesome solid via `@fortawesome/react-fontawesome` (already
  used by `GlobalAudioPlayer`).
- No inline styles in JSX (per `feedback_no_inline_styles` memory). All visual
  state via modifier classes.

Imported from the main bundle's index alongside other `_*-refined.scss` files.

## Testing

- **Vitest** for new React components — follow the
  `front-end/react/todo/*.test.tsx` pattern. Cover:
  - `LibrarySidebar`: renders nav + playlists; click sets active; double‑click
    emits play‑track event; query expression render for each parameter shape.
  - `StatStrip`: renders all five cells; pulsing‑dot class toggles on
    `audio-play` / `audio-pause`.
  - `PageHead`: ⌘K focuses input; clear button shows when value present;
    breadcrumb appends playlist name when filtering.
  - `SongTable`: row click emits `play-track` with the visible list as queue;
    star click PATCHes via `set_song_rating`; currently‑playing row reflects
    `audio-play`.
  - `describeSmartPlaylist`: pure unit tests over each shape.
- **Pytest** in `bordercore/music/tests/test_services.py`:
  - `get_dashboard_stats`: empty user → zeros; user with listens across days
    → correct streak; tag aggregation picks the most‑listened tag in 7d.
  - `get_recent_albums`: shape includes `track_count`, `playtime`, `tags`,
    `rating`, `plays`.
- Mark tests with `@pytest.mark.django_db`. Use existing fixtures.

## Out of scope

- Replacing `GlobalAudioPlayer` engine.
- Tabs for albums / songs / artists / tags inside the dashboard.
- Curated "album of the week" — uses random.
- Manual rearrangement of playlists in the sidebar.
- Drag‑to‑reorder anywhere on the dashboard.
- Mobile breakpoints below 1100px (the README itself defers these).

## Risks / open issues

- The handoff mentions a `transform: scale()` wrapper to fit the 1280×900 canvas
  to viewport. We won't ship that — the layout is responsive within the
  base.html column. Visual fidelity at non‑desktop widths is best‑effort.
- "Real‑time" updates to recent‑plays / stat strip happen via `EventBus`
  callbacks. They reflect player events but won't catch listens from other
  tabs / devices. Acceptable for v1.
- `top_tag_7d` requires every Song's `tags` to be normalized; if there are
  songs without tags they're ignored.
