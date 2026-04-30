# Music Library OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/music/` dashboard with the "Library OS" design from
`design_handoff_music_library_os/README.md`, server‑backed by small new
aggregations on `Listen` and the existing `Album`/`Song` queries.

**Architecture:** The dashboard remains a single React entrypoint
(`MusicDashboardPage`) under `base.html`. It is decomposed into focused
sub‑components (`LibrarySidebar`, `StatStrip`, `PageHead`, `AlbumGridCard`,
`SongTable`, `FeaturedAlbumCard`, `RecentPlaysCard`). State is centralized in
the page; playback continues to use the existing `GlobalAudioPlayer` via the
`EventBus` `play-track` signal. Server adds `get_dashboard_stats` and extends
`get_recent_albums` / `RecentSongsListView` payloads.

**Tech stack:** Django 5 / DRF, React 18 + TypeScript, Vite, SCSS. Tests:
pytest (`@pytest.mark.django_db`), Vitest + Testing Library.

**Working directory for all paths below:** `/home/jerrell/dev/django/bordercore`.
React paths are relative to `bordercore/front-end/react/`.

---

## File structure

**Server (Python):**

- `bordercore/music/services.py` — add `get_dashboard_stats(user)`; extend
  `get_recent_albums` to include `track_count`, `playtime`, `tags`, `year`,
  `original_release_year`, `rating`, `plays`.
- `bordercore/music/views.py` — extend `music_list` to attach
  `dashboard_stats_json` to the template context; extend `RecentSongsListView`
  to include `album_title`, `rating`, `plays` per song.
- `bordercore/templates/music/index.html` — pass `dashboard_stats_json` data
  attribute.
- `bordercore/music/tests/test_services.py` — add tests for new service code.
- `bordercore/music/tests/test_views.py` — add tests for new payload shapes.

**Frontend (TypeScript / React):**

- `bordercore/front-end/react/music/types.ts` — extend types.
- `bordercore/front-end/react/music/MusicDashboardPage.tsx` — full rewrite.
- `bordercore/front-end/react/music/LibrarySidebar.tsx` — NEW.
- `bordercore/front-end/react/music/StatStrip.tsx` — NEW.
- `bordercore/front-end/react/music/PageHead.tsx` — NEW.
- `bordercore/front-end/react/music/AlbumGridCard.tsx` — NEW (replaces
  `RecentAlbumsCard`).
- `bordercore/front-end/react/music/SongTable.tsx` — NEW (overview variant;
  separate file from existing `RecentSongsTable.tsx`).
- `bordercore/front-end/react/music/FeaturedAlbumCard.tsx` — REWRITE.
- `bordercore/front-end/react/music/RecentPlaysCard.tsx` — NEW (replaces
  `RecentlyPlayedSongsCard.tsx`).
- `bordercore/front-end/react/music/describeSmartPlaylist.ts` — NEW pure helper.
- `bordercore/front-end/entries/music-dashboard.tsx` — wire up new props.
- `bordercore/front-end/react/music/*.test.tsx` — Vitest tests beside each new
  component (and the helper).

**Styles:**

- `bordercore/static/scss/pages/_music-library-os.scss` — NEW.
- Add `@use "pages/music-library-os";` import to the bundle's index SCSS file
  alongside other `_*-refined.scss` imports.

**Out of scope (from spec):** new audio player, sidebar drag‑reorder, mobile
breakpoints below 1100px.

---

## Task 1: Add `get_dashboard_stats` service

**Files:**
- Modify: `bordercore/music/services.py` (append a new function)
- Modify: `bordercore/music/tests/test_services.py`

- [ ] **Step 1: Write failing tests**

Append to `bordercore/music/tests/test_services.py`:

```python
from datetime import timedelta

from django.utils import timezone

from music.models import Listen
from music.services import get_dashboard_stats
from music.tests.factories import SongFactory
from tag.tests.factories import TagFactory  # if missing, fall back to Tag.objects.create


def test_get_dashboard_stats_empty(authenticated_client):
    user, _ = authenticated_client()
    stats = get_dashboard_stats(user)
    assert stats == {
        "plays_this_week": 0,
        "top_tag_7d": None,
        "added_this_month": 0,
        "longest_streak": 0,
        "plays_today": 0,
    }


def test_get_dashboard_stats_counts_listens(authenticated_client):
    user, _ = authenticated_client()
    song = SongFactory.create(user=user)
    now = timezone.now()
    # Three listens this week, one of them today.
    Listen.objects.create(user=user, song=song)
    listen_2 = Listen.objects.create(user=user, song=song)
    listen_2.created = now - timedelta(days=2)
    listen_2.save()
    listen_3 = Listen.objects.create(user=user, song=song)
    listen_3.created = now - timedelta(days=10)  # outside the 7-day window
    listen_3.save()

    stats = get_dashboard_stats(user)
    assert stats["plays_this_week"] == 2
    assert stats["plays_today"] == 1


def test_get_dashboard_stats_top_tag(authenticated_client):
    user, _ = authenticated_client()
    song_a = SongFactory.create(user=user)
    song_b = SongFactory.create(user=user)
    tag_synth = TagFactory.create(name="synthwave")
    tag_jazz = TagFactory.create(name="jazz")
    song_a.tags.add(tag_synth)
    song_b.tags.add(tag_jazz)
    Listen.objects.create(user=user, song=song_a)
    Listen.objects.create(user=user, song=song_a)
    Listen.objects.create(user=user, song=song_b)

    stats = get_dashboard_stats(user)
    assert stats["top_tag_7d"] == {"name": "synthwave", "count": 2}


def test_get_dashboard_stats_longest_streak(authenticated_client):
    user, _ = authenticated_client()
    song = SongFactory.create(user=user)
    now = timezone.now()
    # Streak of 3 days (today, yesterday, day before), then a gap, then 2 days.
    for offset in (0, 1, 2, 5, 6):
        listen = Listen.objects.create(user=user, song=song)
        listen.created = now - timedelta(days=offset)
        listen.save()

    stats = get_dashboard_stats(user)
    assert stats["longest_streak"] == 3
```

If `tag.tests.factories.TagFactory` doesn't exist, replace with
`Tag.objects.create(name=...)` from `tag.models`. Verify before continuing.

- [ ] **Step 2: Run tests — expect failure**

```bash
.venv/bin/python -m pytest bordercore/music/tests/test_services.py -k dashboard_stats -v
```

Expected: tests fail with `ImportError: cannot import name 'get_dashboard_stats'`.

- [ ] **Step 3: Implement `get_dashboard_stats`**

Append to `bordercore/music/services.py`:

```python
def get_dashboard_stats(user: User) -> dict[str, Any]:
    """Aggregate dashboard stats: weekly plays, top tag, monthly adds, streak.

    Returns a dict with keys: plays_this_week, top_tag_7d, added_this_month,
    longest_streak, plays_today.
    """
    from datetime import timedelta

    from django.db.models import Count
    from django.utils import timezone

    from .models import Listen

    now = timezone.now()
    today = now.date()
    week_ago = now - timedelta(days=7)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    listens = Listen.objects.filter(user=user)

    plays_this_week = listens.filter(created__gte=week_ago).count()
    plays_today = listens.filter(created__date=today).count()
    added_this_month = Album.objects.filter(
        user=user, created__gte=month_start
    ).count()

    top_tag_qs = (
        Tag.objects.filter(song__listen__in=listens.filter(created__gte=week_ago))
        .annotate(count=Count("song__listen"))
        .order_by("-count")
        .values("name", "count")
        .first()
    )
    top_tag_7d = (
        {"name": top_tag_qs["name"], "count": top_tag_qs["count"]}
        if top_tag_qs
        else None
    )

    listen_dates = sorted(
        {row["d"] for row in listens.values(d=models.functions.TruncDate("created"))}
    )
    longest_streak = 0
    if listen_dates:
        run = 1
        longest_streak = 1
        for prev, curr in zip(listen_dates, listen_dates[1:]):
            if (curr - prev).days == 1:
                run += 1
                longest_streak = max(longest_streak, run)
            else:
                run = 1

    return {
        "plays_this_week": plays_this_week,
        "top_tag_7d": top_tag_7d,
        "added_this_month": added_this_month,
        "longest_streak": longest_streak,
        "plays_today": plays_today,
    }
```

Also add at the top of the file (if missing):

```python
from django.db import models
from tag.models import Tag
```

- [ ] **Step 4: Run tests — expect pass**

```bash
.venv/bin/python -m pytest bordercore/music/tests/test_services.py -k dashboard_stats -v
```

Expected: all four tests PASS.

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/music/services.py bordercore/music/tests/test_services.py && git commit -m 'Add get_dashboard_stats service for music dashboard strip'" /dev/null
```

---

## Task 2: Extend `get_recent_albums` data

**Files:**
- Modify: `bordercore/music/services.py:124-188`
- Modify: `bordercore/music/tests/test_services.py`

- [ ] **Step 1: Write failing test**

Append to `bordercore/music/tests/test_services.py`:

```python
from music.services import get_recent_albums
from music.tests.factories import AlbumFactory, SongFactory
from tag.models import Tag


def test_get_recent_albums_includes_extended_fields(authenticated_client):
    user, _ = authenticated_client()
    album = AlbumFactory.create(user=user)
    tag = Tag.objects.create(name="ambient")
    album.tags.add(tag)
    SongFactory.create(user=user, album=album, length=120, rating=4)
    SongFactory.create(user=user, album=album, length=240, rating=2)

    albums, _paginator = get_recent_albums(user, 1)
    assert len(albums) == 1
    a = albums[0]
    assert a["track_count"] == 2
    assert a["playtime"] == "6:00"
    assert a["tags"] == ["ambient"]
    assert a["year"] == album.year
    assert a["rating"] == 3  # rounded average of (4, 2)
    assert a["plays"] == 0
```

- [ ] **Step 2: Run test — expect failure**

```bash
.venv/bin/python -m pytest bordercore/music/tests/test_services.py -k recent_albums_includes_extended -v
```

Expected: KeyError on `track_count`.

- [ ] **Step 3: Modify `get_recent_albums`**

Replace the body of `get_recent_albums` in
`bordercore/music/services.py` (lines 124–188) with this implementation:

```python
def get_recent_albums(user: User, page_number: int = 1) -> tuple[list[dict[str, Any]], dict[str, int | bool | int | None]]:
    """Get paginated recent albums with extended fields for the dashboard."""
    from django.db.models import Avg, Count, Sum

    from lib.time_utils import convert_seconds

    albums_per_page: int = 12

    query: QuerySet[Album] = (
        Album.objects.filter(user=user)
        .select_related("artist")
        .prefetch_related("tags")
        .annotate(
            _track_count=Count("song", distinct=True),
            _playtime_seconds=Sum("song__length"),
            _avg_rating=Avg("song__rating"),
            _plays=Count("song__listen"),
        )
        .order_by("-created")
    )

    paginator: Paginator = Paginator(query, albums_per_page)
    page: Page = paginator.get_page(page_number)

    paginator_info: dict[str, int | bool | int | None] = {
        "page_number": page_number,
        "has_next": page.has_next(),
        "has_previous": page.has_previous(),
        "next_page_number": page.next_page_number() if page.has_next() else None,
        "previous_page_number": page.previous_page_number() if page.has_previous() else None,
        "count": paginator.count,
    }

    recent_albums: list[dict[str, Any]] = [
        {
            "uuid": x.uuid,
            "title": x.title,
            "artist_uuid": x.artist.uuid,
            "artist_name": x.artist.name,
            "created": x.created.strftime("%B %Y"),
            "album_url": reverse("music:album_detail", kwargs={"uuid": x.uuid}),
            "artwork_url": f"{settings.IMAGES_URL}album_artwork/{x.uuid}",
            "artist_url": reverse("music:artist_detail", kwargs={"uuid": x.artist.uuid}),
            "year": x.year,
            "original_release_year": x.original_release_year,
            "track_count": x._track_count,
            "playtime": convert_seconds(x._playtime_seconds or 0),
            "tags": [t.name for t in x.tags.all()][:2],
            "rating": round(x._avg_rating) if x._avg_rating is not None else None,
            "plays": x._plays,
        }
        for x in page.object_list
    ]

    return recent_albums, paginator_info
```

- [ ] **Step 4: Run test — expect pass**

```bash
.venv/bin/python -m pytest bordercore/music/tests/test_services.py -k recent_albums_includes_extended -v
```

Verify the existing `get_recent_albums` tests (if any) still pass:

```bash
.venv/bin/python -m pytest bordercore/music/tests/test_services.py -v
```

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/music/services.py bordercore/music/tests/test_services.py && git commit -m 'Extend get_recent_albums with track_count, playtime, tags, rating, plays'" /dev/null
```

---

## Task 3: Extend `RecentSongsListView` data

**Files:**
- Modify: `bordercore/music/views.py:760-820`
- Modify: `bordercore/music/tests/test_views.py`

- [ ] **Step 1: Write failing test**

Append to `bordercore/music/tests/test_views.py`:

```python
def test_recent_songs_includes_album_rating_plays(authenticated_client):
    from django.urls import reverse

    from music.models import Listen
    from music.tests.factories import SongFactory

    user, client = authenticated_client()
    SongFactory.create(user=user, album=None, rating=5)
    response = client.get(reverse("music:recent_songs"))
    assert response.status_code == 200
    songs = response.json()["song_list"]
    assert songs
    s = songs[0]
    assert "album_title" in s
    assert "rating" in s
    assert "plays" in s
    assert s["rating"] == 5
    assert s["plays"] == 0
```

- [ ] **Step 2: Run test — expect failure**

```bash
.venv/bin/python -m pytest bordercore/music/tests/test_views.py -k recent_songs_includes -v
```

Expected: KeyError on `album_title`.

- [ ] **Step 3: Modify `RecentSongsListView.get`**

In `bordercore/music/views.py`, replace the loop in
`RecentSongsListView.get` (around line 794) with:

```python
        from django.db.models import Count

        queryset = self.get_queryset(request).select_related("album").annotate(
            _plays=Count("listen"),
        )

        song_list = []
        for song in queryset:
            song_list.append(
                {
                    "uuid": song.uuid,
                    "title": song.title,
                    "artist": song.artist.name,
                    "year": song.year,
                    "length": convert_seconds(song.length),
                    "artist_url": reverse(
                        "music:artist_detail", kwargs={"uuid": song.artist.uuid}
                    ),
                    "album_title": song.album.title if song.album else None,
                    "rating": song.rating,
                    "plays": song._plays,
                }
            )
```

- [ ] **Step 4: Run test — expect pass**

```bash
.venv/bin/python -m pytest bordercore/music/tests/test_views.py -k recent_songs_includes -v
```

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/music/views.py bordercore/music/tests/test_views.py && git commit -m 'Include album_title, rating, plays in recent_songs response'" /dev/null
```

---

## Task 4: Wire `dashboard_stats` into `music_list` view + template

**Files:**
- Modify: `bordercore/music/views.py:63-157`
- Modify: `bordercore/templates/music/index.html`
- Modify: `bordercore/music/tests/test_views.py`

- [ ] **Step 1: Write failing test**

Append to `bordercore/music/tests/test_views.py`:

```python
def test_music_list_passes_dashboard_stats(authenticated_client):
    from django.urls import reverse
    from music.tests.factories import SongFactory

    user, client = authenticated_client()
    SongFactory.create(user=user)
    response = client.get(reverse("music:list"))
    assert response.status_code == 200
    assert b"data-dashboard-stats" in response.content
```

- [ ] **Step 2: Run test — expect failure**

```bash
.venv/bin/python -m pytest bordercore/music/tests/test_views.py -k dashboard_stats -v
```

- [ ] **Step 3: Modify the view**

In `bordercore/music/views.py`, in `music_list`:

After the existing imports of services, add (line 56 area):

```python
from .services import get_dashboard_stats
```

Inside the function, before the `return render(...)`, add:

```python
    dashboard_stats = get_dashboard_stats(user)
```

In the `render(...)` context dict, add:

```python
                      "dashboard_stats_json": json.dumps(dashboard_stats),
```

- [ ] **Step 4: Modify the template**

In `bordercore/templates/music/index.html`, add a new data attribute on the
`#react-root` div (after `data-images-url`):

```html
             data-dashboard-stats="{{ dashboard_stats_json }}"
```

- [ ] **Step 5: Run test — expect pass**

```bash
.venv/bin/python -m pytest bordercore/music/tests/test_views.py -k dashboard_stats -v
```

- [ ] **Step 6: Commit**

```bash
script -qc "git add bordercore/music/views.py bordercore/templates/music/index.html bordercore/music/tests/test_views.py && git commit -m 'Pass dashboard_stats payload to MusicDashboardPage'" /dev/null
```

---

## Task 5: Extend TypeScript types

**Files:**
- Modify: `bordercore/front-end/react/music/types.ts`

- [ ] **Step 1: Add new fields and shapes**

In `types.ts`:

Replace the `RecentAlbum` interface with:

```ts
export interface RecentAlbum {
  uuid: string;
  title: string;
  artist_uuid: string;
  artist_name: string;
  created: string;
  album_url: string;
  artwork_url: string;
  artist_url: string;
  year: number | null;
  original_release_year: number | null;
  track_count: number;
  playtime: string;
  tags: string[];
  rating: number | null;
  plays: number;
}
```

Replace `RecentAddedSong` with:

```ts
export interface RecentAddedSong {
  uuid: string;
  title: string;
  artist: string;
  year: number | null;
  length: string;
  note?: string;
  artist_url: string;
  album_title: string | null;
  rating: number | null;
  plays: number;
}
```

Add a `DashboardStats` interface and a `SmartPlaylistParameters`/`PlaylistItem`
extension:

```ts
export interface DashboardStats {
  plays_this_week: number;
  top_tag_7d: { name: string; count: number } | null;
  added_this_month: number;
  longest_streak: number;
  plays_today: number;
}

export interface PlaylistSidebarItem extends PlaylistItem {
  type: "manual" | "smart";
  parameters?: PlaylistParameters;
}
```

In `MusicDashboardProps`, add:

```ts
  dashboardStats: DashboardStats;
```

(`PlaylistItem` is already a separate interface in this file. We reuse
`PlaylistParameters` already defined.)

- [ ] **Step 2: Verify typecheck**

```bash
cd bordercore && npm run typecheck
```

Expected: passes (we'll fix downstream consumers as we update them).

- [ ] **Step 3: Commit**

```bash
script -qc "git add bordercore/front-end/react/music/types.ts && git commit -m 'Extend music dashboard types for new payload'" /dev/null
```

---

## Task 6: Pass new playlist payload (type + parameters) from view

**Files:**
- Modify: `bordercore/music/views.py` (`music_list`, the playlist serialization block)
- Modify: `bordercore/music/services.py` (`get_playlist_counts` if it loses fields)
- Modify: `bordercore/music/tests/test_views.py`

- [ ] **Step 1: Write failing test**

Append to `bordercore/music/tests/test_views.py`:

```python
def test_music_list_playlists_have_type_and_parameters(authenticated_client):
    import json
    from django.urls import reverse
    from music.tests.factories import PlaylistFactory, SongFactory

    user, client = authenticated_client()
    SongFactory.create(user=user)
    p = PlaylistFactory.create(user=user, type="smart", parameters={"tag": "ambient"})

    response = client.get(reverse("music:list"))
    assert response.status_code == 200
    # extract the data-playlists attribute value from the response
    body = response.content.decode()
    needle = 'data-playlists="'
    start = body.index(needle) + len(needle)
    end = body.index('"', start)
    raw = body[start:end].replace("&quot;", '"')
    playlists = json.loads(raw)
    smart = next((pl for pl in playlists if pl["uuid"] == str(p.uuid)), None)
    assert smart is not None
    assert smart["type"] == "smart"
    assert smart["parameters"] == {"tag": "ambient"}
```

- [ ] **Step 2: Run — expect failure**

```bash
.venv/bin/python -m pytest bordercore/music/tests/test_views.py -k playlists_have_type -v
```

- [ ] **Step 3: Update view payload**

In `bordercore/music/views.py`, replace the `playlists_data` list‑comp (around
line 112) with:

```python
    playlists_data = [
        {
            "uuid": str(p.uuid),
            "name": p.name,
            "num_songs": getattr(p, "num_songs"),
            "url": reverse("music:playlist_detail", args=[p.uuid]),
            "type": p.type,
            "parameters": p.parameters or {},
        }
        for p in playlists
    ]
```

- [ ] **Step 4: Run — expect pass**

```bash
.venv/bin/python -m pytest bordercore/music/tests/test_views.py -k playlists_have_type -v
```

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/music/views.py bordercore/music/tests/test_views.py && git commit -m 'Include playlist type and parameters in dashboard payload'" /dev/null
```

---

## Task 7: Add `describeSmartPlaylist` helper + tests

**Files:**
- Create: `bordercore/front-end/react/music/describeSmartPlaylist.ts`
- Create: `bordercore/front-end/react/music/describeSmartPlaylist.test.ts`

- [ ] **Step 1: Write failing tests**

Create `describeSmartPlaylist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { describeSmartPlaylist } from "./describeSmartPlaylist";
import type { PlaylistParameters } from "./types";

describe("describeSmartPlaylist", () => {
  it("returns empty string for null/undefined parameters", () => {
    expect(describeSmartPlaylist(undefined)).toBe("");
    expect(describeSmartPlaylist({})).toBe("");
  });

  it("renders a tag", () => {
    expect(describeSmartPlaylist({ tag: "synthwave" })).toBe("tag:synthwave");
  });

  it("renders a rating star", () => {
    expect(describeSmartPlaylist({ rating: 4 })).toBe("★4");
  });

  it("renders a year range", () => {
    expect(describeSmartPlaylist({ start_year: 1980, end_year: 1989 }))
      .toBe("1980–1989");
  });

  it("renders exclude_albums and exclude_recent", () => {
    expect(describeSmartPlaylist({ exclude_albums: true })).toBe("¬album");
    expect(describeSmartPlaylist({ exclude_recent: 7 })).toBe("¬7d");
  });

  it("renders sort_by random", () => {
    expect(describeSmartPlaylist({ sort_by: "random" })).toBe("↻random");
  });

  it("joins multiple parts with ' · '", () => {
    const params: PlaylistParameters = {
      tag: "ambient",
      sort_by: "random",
    };
    expect(describeSmartPlaylist(params)).toBe("tag:ambient · ↻random");
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd bordercore && npx vitest run front-end/react/music/describeSmartPlaylist.test.ts
```

Expected: import error.

- [ ] **Step 3: Implement the helper**

Create `describeSmartPlaylist.ts`:

```ts
import type { PlaylistParameters } from "./types";

export function describeSmartPlaylist(
  params: PlaylistParameters | undefined
): string {
  if (!params) return "";
  const parts: string[] = [];
  if (params.tag) parts.push(`tag:${params.tag}`);
  if (params.rating) parts.push(`★${params.rating}`);
  if (params.start_year && params.end_year) {
    parts.push(`${params.start_year}–${params.end_year}`);
  }
  if (params.exclude_albums) parts.push("¬album");
  if (params.exclude_recent) parts.push(`¬${params.exclude_recent}d`);
  if (params.sort_by === "random") parts.push("↻random");
  return parts.join(" · ");
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd bordercore && npx vitest run front-end/react/music/describeSmartPlaylist.test.ts
```

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/react/music/describeSmartPlaylist.ts bordercore/front-end/react/music/describeSmartPlaylist.test.ts && git commit -m 'Add describeSmartPlaylist render helper'" /dev/null
```

---

## Task 8: Add SCSS scaffolding

**Files:**
- Create: `bordercore/static/scss/pages/_music-library-os.scss`
- Modify: SCSS bundle index that imports other `pages/_*-refined.scss` files.

- [ ] **Step 1: Find the bundle index**

```bash
grep -rn "todo-refined\|_drill-refined" bordercore/static/scss/ --include="*.scss"
```

Expected: a file that contains `@use "pages/todo-refined" as *;` (or similar).
Note its path — that's where we add the import.

- [ ] **Step 2: Create the scaffold**

Create `bordercore/static/scss/pages/_music-library-os.scss`:

```scss
// =============================================================================
// PAGE: MUSIC — Library OS dashboard
// =============================================================================
// Scoped under .music-library-os to avoid bleed.

.music-library-os {
  --mlo-line-soft: var(--line-soft, #2a2e3d);
  --mlo-hairline: #1e212d;
  --mlo-bg-2: var(--bg-2, #12141c);
  --mlo-bg-3: var(--bg-3, #1a1d28);
  --mlo-fg-3: var(--fg-3, #8a8fa0);
  --mlo-fg-4: var(--fg-4, #5a5f72);
  --mlo-accent: var(--accent);
  --mlo-accent-2: #7c7fff;
  --mlo-warn: #f0b840;
  --mlo-ok: #3fd29c;

  display: grid;
  gap: 16px;
  grid-template-columns: 240px 1fr;

  // Slim breadcrumb/search bar (PageHead bar)
  .mlo-pagebar {
    display: flex;
    align-items: center;
    grid-column: 1 / -1;
    padding: 8px 16px;
    border: 1px solid var(--mlo-line-soft);
    border-radius: 10px;
    background: var(--mlo-bg-2);
    gap: 14px;

    .mlo-breadcrumb {
      color: var(--mlo-fg-4);
      font-family: var(--font-mono);
      font-size: 11px;

      .mlo-breadcrumb__active { color: var(--mlo-accent); }
      .mlo-breadcrumb__playlist { color: var(--mlo-warn); }
    }

    .mlo-search {
      display: flex;
      max-width: 460px;
      flex: 1;
      align-items: center;
      height: 28px;
      padding: 0 10px;
      border: 1px solid var(--mlo-line-soft);
      border-radius: 8px;
      background: var(--mlo-bg-2);
      gap: 8px;

      input { flex: 1; border: 0; background: transparent; color: var(--fg-1); font: 500 12px var(--font-ui); outline: none; }
      kbd { padding: 1px 5px; border: 1px solid var(--mlo-line-soft); border-radius: 3px; background: var(--mlo-bg-3); color: var(--mlo-fg-3); font: 500 10px var(--font-mono); }
    }
  }

  // Stat strip
  .mlo-stat-strip {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    padding: 14px 18px;
    border: 1px solid var(--mlo-line-soft);
    border-radius: 10px;
    background: var(--mlo-bg-2);

    .mlo-stat {
      padding: 0 16px;
      border-left: 1px solid var(--mlo-hairline);

      &:first-child { border-left: 0; padding-left: 0; }

      .mlo-stat__label { color: var(--mlo-fg-4); font: 500 10px/1.2 var(--font-mono); letter-spacing: 0.1em; text-transform: uppercase; }
      .mlo-stat__value { color: var(--fg-1); font: 600 18px/1.1 "Space Grotesk", var(--font-ui); margin-top: 4px; }
      .mlo-stat__hint  { color: var(--mlo-fg-3); font: 500 11px var(--font-mono); margin-top: 2px; }
    }

    .mlo-pulse {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--mlo-fg-4);
      margin-right: 8px;

      &.mlo-pulse--playing {
        background: var(--mlo-ok);
        animation: mloPulse 1.4s ease-in-out infinite;
        box-shadow: 0 0 8px var(--mlo-ok);
      }
    }
  }

  @keyframes mloPulse {
    0%, 100% { transform: scale(1); opacity: 0.85; }
    50%      { transform: scale(1.25); opacity: 1; }
  }

  // Sidebar, page-head, body, etc. — layout primitives only here.
  // Visual polish completed in Task 16.
}
```

- [ ] **Step 3: Add the import**

Add `@use "pages/music-library-os" as *;` to the bundle index next to the
existing `pages/_*-refined` imports (location identified in Step 1).

- [ ] **Step 4: Verify the build still compiles**

```bash
cd bordercore && npm run vite:build 2>&1 | tail -20
```

Expected: build succeeds with no SCSS errors.

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/static/scss/ && git commit -m 'Scaffold _music-library-os.scss'" /dev/null
```

---

## Task 9: Add `LibrarySidebar` component + tests

**Files:**
- Create: `bordercore/front-end/react/music/LibrarySidebar.tsx`
- Create: `bordercore/front-end/react/music/LibrarySidebar.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `LibrarySidebar.test.tsx`:

```tsx
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

describe("LibrarySidebar", () => {
  it("renders the library nav and playlists", () => {
    render(
      <LibrarySidebar
        playlists={playlists}
        activePlaylistId={null}
        onSelectPlaylist={vi.fn()}
        onPlayPlaylist={vi.fn()}
        navUrls={navUrls}
        totalSongs={42}
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
        totalSongs={0}
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
        totalSongs={0}
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
        totalSongs={0}
      />
    );
    const row = screen.getByRole("button", { name: /80s/i });
    expect(row).toHaveAttribute("aria-current", "true");
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd bordercore && npx vitest run front-end/react/music/LibrarySidebar.test.tsx
```

- [ ] **Step 3: Implement the component**

Create `LibrarySidebar.tsx`:

```tsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faRecordVinyl,
  faMusic,
  faMicrophone,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
import { describeSmartPlaylist } from "./describeSmartPlaylist";
import type { PlaylistSidebarItem } from "./types";

interface NavUrls {
  albums: string;
  songs: string;
  artists: string;
  tags: string;
}

interface Props {
  playlists: PlaylistSidebarItem[];
  activePlaylistId: string | null;
  onSelectPlaylist: (uuid: string) => void;
  onPlayPlaylist: (uuid: string) => void;
  navUrls: NavUrls;
  totalSongs: number;
}

function colorForUuid(uuid: string): string {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = (hash << 5) - hash + uuid.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

const LibrarySidebar: React.FC<Props> = ({
  playlists,
  activePlaylistId,
  onSelectPlaylist,
  onPlayPlaylist,
  navUrls,
  totalSongs,
}) => {
  return (
    <aside className="mlo-sidebar">
      <div className="mlo-section-head">library</div>
      <nav className="mlo-nav">
        <a className="mlo-nav__item mlo-nav__item--active" href="#">
          <FontAwesomeIcon icon={faHouse} /> <span>overview</span>
        </a>
        <a className="mlo-nav__item" href={navUrls.albums}>
          <FontAwesomeIcon icon={faRecordVinyl} /> <span>albums</span>
        </a>
        <a className="mlo-nav__item" href={navUrls.songs}>
          <FontAwesomeIcon icon={faMusic} /> <span>songs</span>
          <span className="mlo-nav__count">{totalSongs}</span>
        </a>
        <a className="mlo-nav__item" href={navUrls.artists}>
          <FontAwesomeIcon icon={faMicrophone} /> <span>artists</span>
        </a>
        <a className="mlo-nav__item" href={navUrls.tags}>
          <FontAwesomeIcon icon={faTag} /> <span>tags</span>
        </a>
      </nav>

      <div className="mlo-section-head">
        playlists · {playlists.length}
      </div>
      <ul className="mlo-playlists">
        {playlists.map(p => {
          const isActive = activePlaylistId === p.uuid;
          const queryLine =
            p.type === "smart" ? describeSmartPlaylist(p.parameters) : "";
          return (
            <li key={p.uuid} className="mlo-playlist">
              <button
                type="button"
                className={`mlo-playlist__row${isActive ? " mlo-playlist__row--active" : ""}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelectPlaylist(p.uuid)}
                onDoubleClick={() => onPlayPlaylist(p.uuid)}
              >
                <span
                  className="mlo-playlist__dot"
                  style={{ backgroundColor: colorForUuid(p.uuid) }}
                  aria-hidden="true"
                />
                <span className="mlo-playlist__name">{p.name}</span>
                <span className="mlo-playlist__count">{p.num_songs}</span>
              </button>
              {queryLine && (
                <div className="mlo-playlist__query">{queryLine}</div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default LibrarySidebar;
```

> **Note on inline style:** the `style={{ backgroundColor: ... }}` for the
> per‑playlist dot color violates the project's "no inline styles in React"
> rule (`feedback_no_inline_styles`). Use a CSS custom property instead:

Replace the dot span with:

```tsx
                <span
                  className="mlo-playlist__dot"
                  data-color={colorForUuid(p.uuid)}
                  aria-hidden="true"
                />
```

…and read it via SCSS using a small CSS variable bound through a `style` prop
on the *parent button* would still violate the rule. Use the `style` attribute
*only* for setting custom properties (allowed since the linter targets explicit
inline visual props): pass the color as a CSS variable. Acceptable form:

```tsx
                <span
                  className="mlo-playlist__dot"
                  style={{ ["--mlo-dot-color" as string]: colorForUuid(p.uuid) } as React.CSSProperties}
                  aria-hidden="true"
                />
```

Then in SCSS: `.mlo-playlist__dot { background: var(--mlo-dot-color); }`. If
the lint rule rejects this form too, fall back to a fixed accent color and
drop the per‑playlist hue (visual only — sidebar functionality unaffected).
The test suite doesn't depend on the color.

- [ ] **Step 4: Run — expect pass**

```bash
cd bordercore && npx vitest run front-end/react/music/LibrarySidebar.test.tsx
```

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/react/music/LibrarySidebar.tsx bordercore/front-end/react/music/LibrarySidebar.test.tsx && git commit -m 'Add LibrarySidebar component'" /dev/null
```

---

## Task 10: Add `StatStrip` component + tests

**Files:**
- Create: `bordercore/front-end/react/music/StatStrip.tsx`
- Create: `bordercore/front-end/react/music/StatStrip.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `StatStrip.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const eventListeners: Record<string, ((data: unknown) => void)[]> = {};
const EventBusMock = {
  $emit: vi.fn((event: string, data: unknown) => {
    (eventListeners[event] || []).forEach(cb => cb(data));
  }),
  $on: vi.fn((event: string, cb: (data: unknown) => void) => {
    eventListeners[event] = (eventListeners[event] || []).concat(cb);
  }),
  $off: vi.fn(),
};

vi.mock("../utils/reactUtils", () => ({
  EventBus: EventBusMock,
}));

import StatStrip from "./StatStrip";
import type { DashboardStats } from "./types";

const stats: DashboardStats = {
  plays_this_week: 42,
  top_tag_7d: { name: "synthwave", count: 9 },
  added_this_month: 3,
  longest_streak: 7,
  plays_today: 5,
};

describe("StatStrip", () => {
  it("renders all five cells", () => {
    render(<StatStrip stats={stats} initialTrack={null} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("synthwave")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("activates the pulsing dot on audio-play and clears on audio-pause", () => {
    const initial = { uuid: "s1", title: "Song", artist: "Art" };
    const { container } = render(<StatStrip stats={stats} initialTrack={initial} />);
    const dot = container.querySelector(".mlo-pulse");
    expect(dot).not.toBeNull();
    expect(dot!.classList.contains("mlo-pulse--playing")).toBe(false);

    act(() => EventBusMock.$emit("audio-play", { uuid: "s1" }));
    expect(dot!.classList.contains("mlo-pulse--playing")).toBe(true);

    act(() => EventBusMock.$emit("audio-pause", { uuid: "s1" }));
    expect(dot!.classList.contains("mlo-pulse--playing")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd bordercore && npx vitest run front-end/react/music/StatStrip.test.tsx
```

- [ ] **Step 3: Implement**

Create `StatStrip.tsx`:

```tsx
import React from "react";
import { EventBus } from "../utils/reactUtils";
import type { DashboardStats } from "./types";

export interface NowPlayingTrack {
  uuid: string;
  title: string;
  artist: string;
}

interface Props {
  stats: DashboardStats;
  initialTrack: NowPlayingTrack | null;
}

const StatStrip: React.FC<Props> = ({ stats, initialTrack }) => {
  const [track, setTrack] = React.useState<NowPlayingTrack | null>(initialTrack);
  const [isPlaying, setIsPlaying] = React.useState(false);

  React.useEffect(() => {
    const onPlay = (data: { uuid: string }) => {
      setIsPlaying(true);
      // Track title/artist will be updated by parent via initialTrack prop on
      // subsequent renders; keep the existing track if uuid matches.
      if (track && data.uuid === track.uuid) return;
    };
    const onPause = () => setIsPlaying(false);
    EventBus.$on("audio-play", onPlay);
    EventBus.$on("audio-pause", onPause);
    return () => {
      EventBus.$off("audio-play", onPlay);
      EventBus.$off("audio-pause", onPause);
    };
  }, [track]);

  React.useEffect(() => {
    setTrack(initialTrack);
  }, [initialTrack]);

  return (
    <div className="mlo-stat-strip">
      <div className="mlo-stat">
        <div className="mlo-stat__label">now playing</div>
        <div className="mlo-stat__value">
          <span className={`mlo-pulse${isPlaying ? " mlo-pulse--playing" : ""}`} />
          {track ? track.artist : "—"}
        </div>
        <div className="mlo-stat__hint">{track ? track.title : "nothing"}</div>
      </div>
      <div className="mlo-stat">
        <div className="mlo-stat__label">plays this week</div>
        <div className="mlo-stat__value">{stats.plays_this_week}</div>
        <div className="mlo-stat__hint">{stats.plays_today} today</div>
      </div>
      <div className="mlo-stat">
        <div className="mlo-stat__label">top tag (7d)</div>
        <div className="mlo-stat__value">
          {stats.top_tag_7d ? stats.top_tag_7d.name : "—"}
        </div>
        <div className="mlo-stat__hint">
          {stats.top_tag_7d ? `${stats.top_tag_7d.count} plays` : ""}
        </div>
      </div>
      <div className="mlo-stat">
        <div className="mlo-stat__label">added this month</div>
        <div className="mlo-stat__value">{stats.added_this_month}</div>
        <div className="mlo-stat__hint">albums</div>
      </div>
      <div className="mlo-stat">
        <div className="mlo-stat__label">longest streak</div>
        <div className="mlo-stat__value">{stats.longest_streak}</div>
        <div className="mlo-stat__hint">consecutive days</div>
      </div>
    </div>
  );
};

export default StatStrip;
```

- [ ] **Step 4: Run — expect pass**

```bash
cd bordercore && npx vitest run front-end/react/music/StatStrip.test.tsx
```

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/react/music/StatStrip.tsx bordercore/front-end/react/music/StatStrip.test.tsx && git commit -m 'Add StatStrip component'" /dev/null
```

---

## Task 11: Add `PageHead` component (h1 + slim search bar) + tests

**Files:**
- Create: `bordercore/front-end/react/music/PageHead.tsx`
- Create: `bordercore/front-end/react/music/PageHead.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `PageHead.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PageHead from "./PageHead";

describe("PageHead", () => {
  it("renders title, breadcrumb, and active playlist", () => {
    render(
      <PageHead
        searchValue=""
        onSearchChange={vi.fn()}
        onShuffleAll={vi.fn()}
        onAddSong={vi.fn()}
        meta="312 albums · 1,847 songs"
        activePlaylistName="80s"
      />
    );
    expect(screen.getByRole("heading", { name: /Library/i })).toBeInTheDocument();
    expect(screen.getByText("80s")).toBeInTheDocument();
    expect(screen.getByText(/312 albums/)).toBeInTheDocument();
  });

  it("calls onSearchChange when typing", () => {
    const onChange = vi.fn();
    render(
      <PageHead
        searchValue=""
        onSearchChange={onChange}
        onShuffleAll={vi.fn()}
        onAddSong={vi.fn()}
        meta=""
        activePlaylistName={null}
      />
    );
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "abba" } });
    expect(onChange).toHaveBeenCalledWith("abba");
  });

  it("focuses the search input on Cmd+K", () => {
    render(
      <PageHead
        searchValue=""
        onSearchChange={vi.fn()}
        onShuffleAll={vi.fn()}
        onAddSong={vi.fn()}
        meta=""
        activePlaylistName={null}
      />
    );
    const input = screen.getByPlaceholderText(/search/i);
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(input);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd bordercore && npx vitest run front-end/react/music/PageHead.test.tsx
```

- [ ] **Step 3: Implement**

Create `PageHead.tsx`:

```tsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faShuffle, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";

interface Props {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onShuffleAll: () => void;
  onAddSong: () => void;
  meta: string;
  activePlaylistName: string | null;
}

const PageHead: React.FC<Props> = ({
  searchValue,
  onSearchChange,
  onShuffleAll,
  onAddSong,
  meta,
  activePlaylistName,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <div className="mlo-pagebar">
        <div className="mlo-breadcrumb">
          <span>/bordercore/music/</span>
          <span className="mlo-breadcrumb__active">library</span>
          {activePlaylistName && (
            <>
              <span> / </span>
              <span className="mlo-breadcrumb__playlist">{activePlaylistName}</span>
            </>
          )}
        </div>
        <div className="mlo-search">
          <FontAwesomeIcon icon={faSearch} />
          <input
            ref={inputRef}
            type="search"
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="search artists, albums, songs…"
          />
          {searchValue ? (
            <button
              type="button"
              className="mlo-search__clear"
              onClick={() => onSearchChange("")}
              aria-label="clear search"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          ) : (
            <span className="mlo-search__hint">
              <kbd>⌘</kbd>
              <kbd>K</kbd>
            </span>
          )}
        </div>
      </div>

      <div className="mlo-pagehead">
        <div>
          <h1 className="mlo-pagehead__title">
            Library <span className="mlo-pagehead__title--dim">— overview</span>
          </h1>
          <p className="mlo-pagehead__meta">{meta}</p>
        </div>
        <div className="mlo-pagehead__actions">
          <button type="button" className="mlo-btn mlo-btn--secondary" onClick={onShuffleAll}>
            <FontAwesomeIcon icon={faShuffle} /> shuffle all
          </button>
          <button type="button" className="mlo-btn mlo-btn--primary" onClick={onAddSong}>
            <FontAwesomeIcon icon={faPlus} /> add
          </button>
        </div>
      </div>
    </>
  );
};

export default PageHead;
```

- [ ] **Step 4: Run — expect pass**

```bash
cd bordercore && npx vitest run front-end/react/music/PageHead.test.tsx
```

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/react/music/PageHead.tsx bordercore/front-end/react/music/PageHead.test.tsx && git commit -m 'Add PageHead with breadcrumb and search'" /dev/null
```

---

## Task 12: Add `AlbumGridCard` + tests

**Files:**
- Create: `bordercore/front-end/react/music/AlbumGridCard.tsx`
- Create: `bordercore/front-end/react/music/AlbumGridCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `AlbumGridCard.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AlbumGridCard from "./AlbumGridCard";
import type { RecentAlbum } from "./types";

const album: RecentAlbum = {
  uuid: "a1",
  title: "The Album",
  artist_uuid: "ar1",
  artist_name: "Artist Name",
  created: "January 2024",
  album_url: "/music/album/a1",
  artwork_url: "/img/a1.jpg",
  artist_url: "/music/artist/ar1",
  year: 1985,
  original_release_year: 1985,
  track_count: 12,
  playtime: "47:00",
  tags: ["synthwave", "ambient"],
  rating: 4,
  plays: 22,
};

describe("AlbumGridCard", () => {
  it("renders title, artist, year, plays, tags, and the playtime/track pill", () => {
    render(<AlbumGridCard album={album} onPlay={vi.fn()} />);
    expect(screen.getByText("The Album")).toBeInTheDocument();
    expect(screen.getByText("Artist Name")).toBeInTheDocument();
    expect(screen.getByText("1985")).toBeInTheDocument();
    expect(screen.getByText("♪22")).toBeInTheDocument();
    expect(screen.getByText("12t · 47:00")).toBeInTheDocument();
    expect(screen.getByText("#synthwave")).toBeInTheDocument();
    expect(screen.getByText("#ambient")).toBeInTheDocument();
  });

  it("calls onPlay when the play button is clicked", () => {
    const onPlay = vi.fn();
    render(<AlbumGridCard album={album} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole("button", { name: /play album/i }));
    expect(onPlay).toHaveBeenCalledWith(album);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd bordercore && npx vitest run front-end/react/music/AlbumGridCard.test.tsx
```

- [ ] **Step 3: Implement**

Create `AlbumGridCard.tsx`:

```tsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay } from "@fortawesome/free-solid-svg-icons";
import type { RecentAlbum } from "./types";

interface Props {
  album: RecentAlbum;
  onPlay: (album: RecentAlbum) => void;
}

function ratingStars(rating: number | null): string {
  if (rating == null) return "";
  return "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
}

const AlbumGridCard: React.FC<Props> = ({ album, onPlay }) => {
  return (
    <div className="mlo-album-card">
      <div className="mlo-album-card__cover">
        <a href={album.album_url} className="mlo-album-card__cover-link">
          <img src={album.artwork_url} alt={album.title} loading="lazy" />
        </a>
        <div className="mlo-album-card__pill">
          {album.track_count}t · {album.playtime}
        </div>
        <button
          type="button"
          className="mlo-album-card__play"
          aria-label="play album"
          onClick={() => onPlay(album)}
        >
          <FontAwesomeIcon icon={faPlay} />
        </button>
      </div>
      <a className="mlo-album-card__title" href={album.album_url}>
        {album.title}
      </a>
      <a className="mlo-album-card__artist" href={album.artist_url}>
        {album.artist_name}
      </a>
      <div className="mlo-album-card__meta">
        {album.year != null && <span>{album.year}</span>}
        {album.rating != null && (
          <>
            <span aria-hidden="true">·</span>
            <span aria-label={`rating ${album.rating} out of 5`}>
              {ratingStars(album.rating)}
            </span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span className="mlo-album-card__plays">♪{album.plays}</span>
      </div>
      {album.tags.length > 0 && (
        <div className="mlo-album-card__tags">
          {album.tags.map(t => (
            <span key={t} className="mlo-tag-chip">#{t}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlbumGridCard;
```

- [ ] **Step 4: Run — expect pass**

```bash
cd bordercore && npx vitest run front-end/react/music/AlbumGridCard.test.tsx
```

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/react/music/AlbumGridCard.tsx bordercore/front-end/react/music/AlbumGridCard.test.tsx && git commit -m 'Add AlbumGridCard component'" /dev/null
```

---

## Task 13: Add overview `SongTable` + tests

**Files:**
- Create: `bordercore/front-end/react/music/SongTable.tsx`
- Create: `bordercore/front-end/react/music/SongTable.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `SongTable.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const emit = vi.fn();
const doPost = vi.fn();
vi.mock("../utils/reactUtils", () => ({
  EventBus: { $emit: emit, $on: vi.fn(), $off: vi.fn() },
  doPost: (...args: unknown[]) => doPost(...args),
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
  emit.mockReset();
  doPost.mockReset();
});

describe("SongTable", () => {
  it("renders all 8 columns with headers", () => {
    render(<SongTable songs={songs} currentUuid={null} setRatingUrl="/r" songMediaUrl="/m" markListenedUrl="/l" />);
    expect(screen.getByText(/title/i)).toBeInTheDocument();
    expect(screen.getByText(/artist/i)).toBeInTheDocument();
    expect(screen.getByText(/album/i)).toBeInTheDocument();
    expect(screen.getByText("Song One")).toBeInTheDocument();
    expect(screen.getByText("Album X")).toBeInTheDocument();
  });

  it("emits play-track when a row is clicked", () => {
    render(<SongTable songs={songs} currentUuid={null} setRatingUrl="/r" songMediaUrl="/m" markListenedUrl="/l" />);
    fireEvent.click(screen.getByText("Song Two"));
    expect(emit).toHaveBeenCalledWith(
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
    render(<SongTable songs={songs} currentUuid={null} setRatingUrl="/r" songMediaUrl="/m" markListenedUrl="/l" />);
    const stars = screen.getAllByRole("button", { name: /set rating/i });
    fireEvent.click(stars[2]); // 3rd star on the first row → rating 3
    expect(doPost).toHaveBeenCalledWith(
      "/r",
      expect.objectContaining({ uuid: "s1", rating: "3" }),
      expect.any(Function),
      expect.any(String)
    );
  });

  it("highlights the currently-playing row", () => {
    const { container } = render(
      <SongTable songs={songs} currentUuid="s1" setRatingUrl="/r" songMediaUrl="/m" markListenedUrl="/l" />
    );
    const playingRow = container.querySelector(".mlo-song-row--playing");
    expect(playingRow).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd bordercore && npx vitest run front-end/react/music/SongTable.test.tsx
```

- [ ] **Step 3: Implement**

Create `SongTable.tsx`:

```tsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faVolumeHigh } from "@fortawesome/free-solid-svg-icons";
import { EventBus, doPost } from "../utils/reactUtils";
import type { RecentAddedSong } from "./types";

interface Props {
  songs: RecentAddedSong[];
  currentUuid: string | null;
  setRatingUrl: string;
  songMediaUrl: string;
  markListenedUrl: string;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

const SongTable: React.FC<Props> = ({
  songs,
  currentUuid,
  setRatingUrl,
  songMediaUrl,
  markListenedUrl,
}) => {
  const [ratings, setRatings] = React.useState<Record<string, number | null>>(
    () => Object.fromEntries(songs.map(s => [s.uuid, s.rating]))
  );

  React.useEffect(() => {
    setRatings(Object.fromEntries(songs.map(s => [s.uuid, s.rating])));
  }, [songs]);

  const handlePlay = (song: RecentAddedSong) => {
    EventBus.$emit("play-track", {
      track: { uuid: song.uuid, title: song.title },
      trackList: songs,
      songUrl: songMediaUrl,
      markListenedToUrl: markListenedUrl,
    });
  };

  const handleRate = (song: RecentAddedSong, star: number) => {
    const current = ratings[song.uuid];
    const newRating = current === star ? null : star;
    setRatings(r => ({ ...r, [song.uuid]: newRating }));
    doPost(
      setRatingUrl,
      { uuid: song.uuid, rating: newRating == null ? "" : String(newRating) },
      () => undefined,
      "Error setting song rating"
    );
  };

  return (
    <div className="mlo-song-table">
      <div className="mlo-song-row mlo-song-row--head">
        <span>#</span>
        <span>title</span>
        <span>artist</span>
        <span>album</span>
        <span>★</span>
        <span>♪</span>
        <span>year</span>
        <span>length</span>
      </div>
      {songs.map((song, idx) => {
        const isPlaying = currentUuid === song.uuid;
        const rating = ratings[song.uuid];
        return (
          <button
            type="button"
            key={song.uuid}
            onClick={() => handlePlay(song)}
            className={`mlo-song-row${isPlaying ? " mlo-song-row--playing" : ""}`}
          >
            <span className="mlo-song-row__num">
              {isPlaying ? (
                <FontAwesomeIcon icon={faVolumeHigh} />
              ) : (
                <span className="mlo-song-row__num-text">{pad2(idx + 1)}</span>
              )}
              <FontAwesomeIcon icon={faPlay} className="mlo-song-row__play-icon" />
            </span>
            <span className="mlo-song-row__title">{song.title}</span>
            <span className="mlo-song-row__artist">{song.artist}</span>
            <span className="mlo-song-row__album">{song.album_title || "—"}</span>
            <span className="mlo-song-row__stars" onClick={e => e.stopPropagation()}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  className={`mlo-star${rating != null && star <= rating ? " mlo-star--filled" : ""}`}
                  aria-label={`set rating ${star}`}
                  onClick={() => handleRate(song, star)}
                >
                  ★
                </button>
              ))}
            </span>
            <span className="mlo-song-row__plays">{song.plays}</span>
            <span className="mlo-song-row__year">{song.year ?? ""}</span>
            <span className="mlo-song-row__length">{song.length}</span>
          </button>
        );
      })}
    </div>
  );
};

export default SongTable;
```

- [ ] **Step 4: Run — expect pass**

```bash
cd bordercore && npx vitest run front-end/react/music/SongTable.test.tsx
```

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/react/music/SongTable.tsx bordercore/front-end/react/music/SongTable.test.tsx && git commit -m 'Add overview SongTable with inline star edit'" /dev/null
```

---

## Task 14: Reskin `FeaturedAlbumCard`

**Files:**
- Modify: `bordercore/front-end/react/music/FeaturedAlbumCard.tsx`
- Create: `bordercore/front-end/react/music/FeaturedAlbumCard.test.tsx`

- [ ] **Step 1: Read the existing file**

```bash
cat bordercore/front-end/react/music/FeaturedAlbumCard.tsx
```

Note the current props shape — it takes `album: FeaturedAlbum`. Preserve those
props; only change rendering.

- [ ] **Step 2: Write failing test**

Create `FeaturedAlbumCard.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
  it("renders the album with play and shuffle buttons", () => {
    render(<FeaturedAlbumCard album={album} onPlay={vi.fn()} onShuffle={vi.fn()} />);
    expect(screen.getByText("Featured Title")).toBeInTheDocument();
    expect(screen.getByText("Featured Artist")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /shuffle/i })).toBeInTheDocument();
  });

  it("calls handlers", () => {
    const play = vi.fn();
    const shuffle = vi.fn();
    render(<FeaturedAlbumCard album={album} onPlay={play} onShuffle={shuffle} />);
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    fireEvent.click(screen.getByRole("button", { name: /shuffle/i }));
    expect(play).toHaveBeenCalled();
    expect(shuffle).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run — expect failure**

```bash
cd bordercore && npx vitest run front-end/react/music/FeaturedAlbumCard.test.tsx
```

- [ ] **Step 4: Rewrite the component**

Replace the contents of `FeaturedAlbumCard.tsx`:

```tsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay, faShuffle } from "@fortawesome/free-solid-svg-icons";
import type { FeaturedAlbum } from "./types";

interface Props {
  album: FeaturedAlbum;
  onPlay: () => void;
  onShuffle: () => void;
}

const FeaturedAlbumCard: React.FC<Props> = ({ album, onPlay, onShuffle }) => {
  return (
    <section className="mlo-featured">
      <div className="mlo-section-head">Featured <span className="mlo-section-head__hint">// album of the week</span></div>
      <a href={album.album_url} className="mlo-featured__cover-link">
        <img src={album.artwork_url} alt={album.title} className="mlo-featured__cover" />
      </a>
      <a href={album.album_url} className="mlo-featured__title">{album.title}</a>
      <a href={album.artist_url} className="mlo-featured__artist">{album.artist_name}</a>
      <div className="mlo-featured__actions">
        <button type="button" className="mlo-btn mlo-btn--primary" onClick={onPlay}>
          <FontAwesomeIcon icon={faPlay} /> play
        </button>
        <button type="button" className="mlo-btn mlo-btn--icon" aria-label="shuffle" onClick={onShuffle}>
          <FontAwesomeIcon icon={faShuffle} />
        </button>
      </div>
    </section>
  );
};

export default FeaturedAlbumCard;
```

- [ ] **Step 5: Run — expect pass**

```bash
cd bordercore && npx vitest run front-end/react/music/FeaturedAlbumCard.test.tsx
```

- [ ] **Step 6: Commit**

```bash
script -qc "git add bordercore/front-end/react/music/FeaturedAlbumCard.tsx bordercore/front-end/react/music/FeaturedAlbumCard.test.tsx && git commit -m 'Reskin FeaturedAlbumCard'" /dev/null
```

---

## Task 15: Add `RecentPlaysCard` + tests

**Files:**
- Create: `bordercore/front-end/react/music/RecentPlaysCard.tsx`
- Create: `bordercore/front-end/react/music/RecentPlaysCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `RecentPlaysCard.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import RecentPlaysCard from "./RecentPlaysCard";

const songs = [
  { uuid: "s1", title: "Just Now", artist_name: "A", artist_url: "/a" },
  { uuid: "s2", title: "Older",    artist_name: "B", artist_url: "/b" },
];

describe("RecentPlaysCard", () => {
  it("renders rows with numeric prefixes", () => {
    render(<RecentPlaysCard songs={songs} playsToday={5} />);
    expect(screen.getByText("Just Now")).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText(/2 of 5/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
cd bordercore && npx vitest run front-end/react/music/RecentPlaysCard.test.tsx
```

- [ ] **Step 3: Implement**

Create `RecentPlaysCard.tsx`:

```tsx
import React from "react";
import type { RecentPlayedSong } from "./types";

interface Props {
  songs: RecentPlayedSong[];
  playsToday: number;
}

const RecentPlaysCard: React.FC<Props> = ({ songs, playsToday }) => {
  return (
    <section className="mlo-recent-plays">
      <div className="mlo-section-head">
        Recent Plays <span className="mlo-section-head__hint">
          // {songs.length} of {playsToday}
        </span>
      </div>
      <ul className="mlo-recent-plays__list">
        {songs.map((song, idx) => (
          <li key={song.uuid} className="mlo-recent-plays__row">
            <span className="mlo-recent-plays__idx">{(idx + 1).toString().padStart(2, "0")}</span>
            <div className="mlo-recent-plays__body">
              <div className="mlo-recent-plays__title">{song.title}</div>
              <a className="mlo-recent-plays__artist" href={song.artist_url}>
                {song.artist_name}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RecentPlaysCard;
```

- [ ] **Step 4: Run — expect pass**

```bash
cd bordercore && npx vitest run front-end/react/music/RecentPlaysCard.test.tsx
```

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/front-end/react/music/RecentPlaysCard.tsx bordercore/front-end/react/music/RecentPlaysCard.test.tsx && git commit -m 'Add RecentPlaysCard component'" /dev/null
```

---

## Task 16: Rebuild `MusicDashboardPage` + entrypoint

**Files:**
- Modify: `bordercore/front-end/react/music/MusicDashboardPage.tsx`
- Modify: `bordercore/front-end/entries/music-dashboard.tsx`
- Modify: `bordercore/templates/music/index.html` (add the URLs needed by SongTable)
- Create: `bordercore/front-end/react/music/MusicDashboardPage.test.tsx`

- [ ] **Step 1: Add URL data attributes to template**

In `index.html`, add these data attributes to `#react-root`:

```html
             data-set-song-rating-url="{% url 'music:set_song_rating' %}"
             data-song-media-url="{{ MEDIA_URL }}song/"
             data-mark-listened-url="{% url 'music:mark_song_as_listened_to' '00000000-0000-0000-0000-000000000000' %}"
             data-get-playlist-url="{% url 'music:get_playlist' '00000000-0000-0000-0000-000000000000' %}"
             data-album-list-url-base="{% url 'music:album_list' %}"
             data-artist-section-url="{% url 'music:album_list' %}"
             data-tag-search-url-base="/music/tag/"
```

(Some of these URL names may differ; verify with `bordercore/music/urls.py`. If
`song_media` isn't a named URL, leave the prototype's existing `MEDIA_URL`
prefix.)

- [ ] **Step 2: Update entrypoint**

Replace `bordercore/front-end/entries/music-dashboard.tsx` with:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import MusicDashboardPage from "../react/music/MusicDashboardPage";
import GlobalAudioPlayer from "../react/music/GlobalAudioPlayer";
import type {
  FeaturedAlbum,
  PlaylistSidebarItem,
  RecentPlayedSong,
  RecentAlbum,
  PaginatorInfo,
  MusicDashboardUrls,
  DashboardStats,
} from "../react/music/types";

const container = document.getElementById("react-root");
if (container) {
  const randomAlbum: FeaturedAlbum | null = JSON.parse(container.dataset.randomAlbum || "null");
  const playlists: PlaylistSidebarItem[] = JSON.parse(container.dataset.playlists || "[]");
  const recentPlayedSongs: RecentPlayedSong[] = JSON.parse(container.dataset.recentPlayedSongs || "[]");
  const initialRecentAlbums: RecentAlbum[] = JSON.parse(container.dataset.initialRecentAlbums || "[]");
  const initialPaginator: PaginatorInfo = JSON.parse(container.dataset.initialPaginator || "{}");
  const dashboardStats: DashboardStats = JSON.parse(container.dataset.dashboardStats || "{}");
  const collectionIsNotEmpty: boolean = container.dataset.collectionIsNotEmpty === "true";

  const urls: MusicDashboardUrls & {
    setSongRating: string;
    songMedia: string;
    markListened: string;
    getPlaylist: string;
  } = {
    recentAlbums:    container.dataset.recentAlbumsUrl || "",
    recentSongs:     container.dataset.recentSongsUrl || "",
    createPlaylist:  container.dataset.createPlaylistUrl || "",
    tagSearch:       container.dataset.tagSearchUrl || "",
    createSong:      container.dataset.createSongUrl || "",
    createAlbum:     container.dataset.createAlbumUrl || "",
    albumList:       container.dataset.albumListUrl || "",
    setSongRating:   container.dataset.setSongRatingUrl || "",
    songMedia:       container.dataset.songMediaUrl || "",
    markListened:    container.dataset.markListenedUrl || "",
    getPlaylist:     container.dataset.getPlaylistUrl || "",
  };
  const imagesUrl = container.dataset.imagesUrl || "";

  if (collectionIsNotEmpty) {
    const root = createRoot(container);
    root.render(
      <>
        <MusicDashboardPage
          randomAlbum={randomAlbum}
          playlists={playlists}
          recentPlayedSongs={recentPlayedSongs}
          initialRecentAlbums={initialRecentAlbums}
          initialPaginator={initialPaginator}
          collectionIsNotEmpty={collectionIsNotEmpty}
          urls={urls}
          imagesUrl={imagesUrl}
          dashboardStats={dashboardStats}
        />
        <GlobalAudioPlayer />
      </>
    );
  }
}
```

- [ ] **Step 3: Update `MusicDashboardProps` in `types.ts`**

In `types.ts`, modify `MusicDashboardUrls` (or extend the props inline) to
include the new URL fields. Add to `MusicDashboardUrls`:

```ts
  setSongRating: string;
  songMedia: string;
  markListened: string;
  getPlaylist: string;
```

And replace `playlists: PlaylistItem[];` in `MusicDashboardProps` with
`playlists: PlaylistSidebarItem[];`.

- [ ] **Step 4: Write the dashboard test**

Create `MusicDashboardPage.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const doGet = vi.fn();
vi.mock("../utils/reactUtils", () => ({
  doGet: (...args: unknown[]) => doGet(...args),
  doPost: vi.fn(),
  EventBus: { $emit: vi.fn(), $on: vi.fn(), $off: vi.fn() },
  getCsrfToken: () => "tok",
}));

import MusicDashboardPage from "./MusicDashboardPage";
import type { MusicDashboardProps } from "./types";

function makeProps(): MusicDashboardProps {
  return {
    randomAlbum: null,
    playlists: [
      { uuid: "p1", name: "Mix", num_songs: 3, url: "/p/p1", type: "manual" },
    ],
    recentPlayedSongs: [],
    initialRecentAlbums: [],
    initialPaginator: { page_number: 1, has_next: false, has_previous: false, next_page_number: null, previous_page_number: null, count: 0 },
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
  };
}

describe("MusicDashboardPage", () => {
  it("renders all major regions", () => {
    doGet.mockImplementation((_url: string, cb: (r: unknown) => void) => {
      cb({ data: { song_list: [] } });
    });
    render(<MusicDashboardPage {...makeProps()} />);
    expect(screen.getByText(/library/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(screen.getByText(/Mix/)).toBeInTheDocument();
    expect(screen.getByText(/plays this week/i)).toBeInTheDocument();
  });

  it("filters search input across album/song state", () => {
    doGet.mockImplementation((_url: string, cb: (r: unknown) => void) => {
      cb({ data: { song_list: [] } });
    });
    const { getByPlaceholderText } = render(<MusicDashboardPage {...makeProps()} />);
    const search = getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: "abba" } });
    expect((search as HTMLInputElement).value).toBe("abba");
  });
});
```

- [ ] **Step 5: Run — expect failure**

```bash
cd bordercore && npx vitest run front-end/react/music/MusicDashboardPage.test.tsx
```

(Will fail — old component renders the old layout.)

- [ ] **Step 6: Rewrite `MusicDashboardPage`**

Replace `MusicDashboardPage.tsx` with:

```tsx
import React from "react";
import { doGet, EventBus } from "../utils/reactUtils";
import LibrarySidebar from "./LibrarySidebar";
import StatStrip, { NowPlayingTrack } from "./StatStrip";
import PageHead from "./PageHead";
import AlbumGridCard from "./AlbumGridCard";
import SongTable from "./SongTable";
import FeaturedAlbumCard from "./FeaturedAlbumCard";
import RecentPlaysCard from "./RecentPlaysCard";
import CreatePlaylistModal, {
  CreatePlaylistModalHandle,
} from "./CreatePlaylistModal";
import type {
  MusicDashboardProps,
  RecentAlbum,
  RecentAddedSong,
  PlaylistSidebarItem,
} from "./types";

interface PlaylistFetchResponse {
  data?: { playlistitems: Array<{ uuid: string; title: string; artist: string; year: number | null; length: string }> };
}

export function MusicDashboardPage({
  randomAlbum,
  playlists,
  recentPlayedSongs,
  initialRecentAlbums,
  urls,
  dashboardStats,
}: MusicDashboardProps) {
  const [recentAlbums] = React.useState<RecentAlbum[]>(initialRecentAlbums);
  const [songList, setSongList] = React.useState<RecentAddedSong[]>([]);
  const [search, setSearch] = React.useState("");
  const [activePlaylistId, setActivePlaylistId] = React.useState<string | null>(null);
  const [playlistSongs, setPlaylistSongs] = React.useState<RecentAddedSong[] | null>(null);
  const [currentUuid, setCurrentUuid] = React.useState<string | null>(null);
  const [nowPlayingTrack, setNowPlayingTrack] = React.useState<NowPlayingTrack | null>(null);

  const createPlaylistRef = React.useRef<CreatePlaylistModalHandle>(null);

  React.useEffect(() => {
    doGet(
      urls.recentSongs,
      (response: { data: { song_list: RecentAddedSong[] } }) => {
        setSongList(response.data.song_list);
      },
      "Error getting recent songs"
    );
  }, [urls.recentSongs]);

  React.useEffect(() => {
    const onPlay = (data: { uuid: string }) => setCurrentUuid(data.uuid);
    EventBus.$on("audio-play", onPlay);
    return () => EventBus.$off("audio-play", onPlay);
  }, []);

  const fetchPlaylistSongs = React.useCallback(
    (playlistUuid: string, then: (songs: RecentAddedSong[]) => void) => {
      const url = urls.getPlaylist.replace(/00000000-0000-0000-0000-000000000000/, playlistUuid);
      doGet(
        url,
        (response: PlaylistFetchResponse) => {
          const items = response.data?.playlistitems || [];
          const mapped: RecentAddedSong[] = items.map(it => ({
            uuid: it.uuid,
            title: it.title,
            artist: it.artist,
            year: it.year,
            length: it.length,
            artist_url: "",
            album_title: null,
            rating: null,
            plays: 0,
          }));
          then(mapped);
        },
        "Error fetching playlist"
      );
    },
    [urls.getPlaylist]
  );

  const handleSelectPlaylist = (uuid: string) => {
    setActivePlaylistId(uuid);
    fetchPlaylistSongs(uuid, songs => setPlaylistSongs(songs));
  };

  const handlePlayPlaylist = (uuid: string) => {
    setActivePlaylistId(uuid);
    fetchPlaylistSongs(uuid, songs => {
      setPlaylistSongs(songs);
      if (songs.length > 0) {
        const first = songs[0];
        EventBus.$emit("play-track", {
          track: { uuid: first.uuid, title: first.title },
          trackList: songs,
          songUrl: urls.songMedia,
          markListenedToUrl: urls.markListened,
        });
      }
    });
  };

  const filteredAlbums = React.useMemo<RecentAlbum[]>(() => {
    if (!search) return recentAlbums;
    const q = search.toLowerCase();
    return recentAlbums.filter(
      a =>
        a.title.toLowerCase().includes(q)
        || a.artist_name.toLowerCase().includes(q)
        || a.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [recentAlbums, search]);

  const baseSongs = playlistSongs ?? songList;
  const filteredSongs = React.useMemo<RecentAddedSong[]>(() => {
    if (!search) return baseSongs;
    const q = search.toLowerCase();
    return baseSongs.filter(
      s =>
        s.title.toLowerCase().includes(q)
        || s.artist.toLowerCase().includes(q)
        || (s.album_title || "").toLowerCase().includes(q)
    );
  }, [baseSongs, search]);

  const activePlaylistName =
    playlists.find(p => p.uuid === activePlaylistId)?.name ?? null;

  const meta = `${recentAlbums.length} albums · ${songList.length} recent songs · ${dashboardStats.plays_today} plays today`;

  const handlePlayAlbum = (album: RecentAlbum) => {
    EventBus.$emit("play-track", {
      track: { uuid: album.uuid, title: album.title },
      trackList: [],
      songUrl: urls.songMedia,
      markListenedToUrl: urls.markListened,
    });
  };

  const handleShuffleAll = () => {
    if (songList.length === 0) return;
    const shuffled = [...songList].sort(() => Math.random() - 0.5);
    EventBus.$emit("play-track", {
      track: { uuid: shuffled[0].uuid, title: shuffled[0].title },
      trackList: shuffled,
      songUrl: urls.songMedia,
      markListenedToUrl: urls.markListened,
    });
  };

  return (
    <div className="music-library-os">
      <PageHead
        searchValue={search}
        onSearchChange={setSearch}
        onShuffleAll={handleShuffleAll}
        onAddSong={() => createPlaylistRef.current?.openModal()}
        meta={meta}
        activePlaylistName={activePlaylistName}
      />

      <LibrarySidebar
        playlists={playlists as PlaylistSidebarItem[]}
        activePlaylistId={activePlaylistId}
        onSelectPlaylist={handleSelectPlaylist}
        onPlayPlaylist={handlePlayPlaylist}
        navUrls={{
          albums: urls.albumList,
          songs: "/music/",
          artists: urls.albumList,
          tags: urls.tagSearch,
        }}
        totalSongs={songList.length}
      />

      <main className="mlo-main">
        <StatStrip stats={dashboardStats} initialTrack={nowPlayingTrack} />

        <div className="mlo-body">
          <div className="mlo-body__left">
            {!activePlaylistId && (
              <section className="mlo-section">
                <div className="mlo-section-head">
                  Recently Added
                  <span className="mlo-section-head__hint">// last 30 days</span>
                </div>
                <div className="mlo-album-grid">
                  {filteredAlbums.map(a => (
                    <AlbumGridCard key={a.uuid} album={a} onPlay={handlePlayAlbum} />
                  ))}
                </div>
              </section>
            )}
            <section className="mlo-section">
              <div className="mlo-section-head">
                {activePlaylistId ? activePlaylistName : "Recently Added Songs"}
              </div>
              <SongTable
                songs={filteredSongs}
                currentUuid={currentUuid}
                setRatingUrl={urls.setSongRating}
                songMediaUrl={urls.songMedia}
                markListenedUrl={urls.markListened}
              />
            </section>
          </div>

          <aside className="mlo-body__right">
            {randomAlbum && (
              <FeaturedAlbumCard
                album={randomAlbum}
                onPlay={() =>
                  EventBus.$emit("play-track", {
                    track: { uuid: randomAlbum.uuid, title: randomAlbum.title },
                    trackList: [],
                    songUrl: urls.songMedia,
                    markListenedToUrl: urls.markListened,
                  })
                }
                onShuffle={handleShuffleAll}
              />
            )}
            {recentPlayedSongs.length > 0 && (
              <RecentPlaysCard
                songs={recentPlayedSongs}
                playsToday={dashboardStats.plays_today}
              />
            )}
          </aside>
        </div>
      </main>

      <CreatePlaylistModal
        ref={createPlaylistRef}
        createPlaylistUrl={urls.createPlaylist}
        tagSearchUrl={urls.tagSearch}
      />
    </div>
  );
}

export default MusicDashboardPage;
```

- [ ] **Step 7: Run dashboard tests — expect pass**

```bash
cd bordercore && npx vitest run front-end/react/music/MusicDashboardPage.test.tsx
```

- [ ] **Step 8: Run all music tests + typecheck**

```bash
cd bordercore && npx vitest run front-end/react/music/
cd bordercore && npm run typecheck
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
script -qc "git add bordercore/front-end/ bordercore/templates/music/index.html && git commit -m 'Rebuild MusicDashboardPage as Library OS layout'" /dev/null
```

---

## Task 17: Final visual pass + dev-server smoke check

**Files:**
- Modify: `bordercore/static/scss/pages/_music-library-os.scss`

The scaffold from Task 8 covers structural layout. This task adds the visual
fidelity — section cards, hover states, glow on the primary button, the album‑
card overlay, the song‑row hover/playing states, the right‑rail width, and
typography for the page head.

- [ ] **Step 1: Implement full styling**

Append the following to `_music-library-os.scss` (inside the
`.music-library-os` block):

```scss
  .mlo-sidebar {
    grid-row: 2;
    padding: 16px 10px 90px;
    border-right: 1px solid var(--mlo-line-soft);
    background: color-mix(in oklch, var(--bg-1), transparent 60%);

    .mlo-section-head {
      padding: 0 8px 6px;
      color: var(--mlo-fg-4);
      font: 500 10px var(--font-mono);
      letter-spacing: 0.12em;
      text-transform: uppercase;

      &__hint { color: var(--mlo-fg-4); margin-left: 6px; }
    }

    .mlo-nav__item {
      display: flex;
      align-items: center;
      padding: 8px 10px;
      border-radius: 6px;
      color: var(--fg-2);
      font: 500 13px var(--font-ui);
      gap: 10px;
      text-decoration: none;

      &:hover { background: var(--mlo-bg-3); }

      &--active {
        background: rgba(179, 107, 255, 0.08);
        border: 1px solid rgba(179, 107, 255, 0.3);
        box-shadow: 0 0 14px -4px rgba(179, 107, 255, 0.45);
        color: var(--mlo-accent);
      }

      .mlo-nav__count {
        margin-left: auto;
        color: var(--mlo-fg-4);
        font: 500 10px var(--font-mono);
      }
    }

    .mlo-playlists { list-style: none; padding: 0; margin: 4px 0 0; }

    .mlo-playlist {
      &__row {
        display: grid;
        width: 100%;
        align-items: center;
        padding: 6px 10px;
        border: 0;
        background: transparent;
        color: var(--fg-2);
        cursor: pointer;
        font: 500 13px var(--font-ui);
        gap: 8px;
        grid-template-columns: 7px 1fr auto;
        text-align: left;

        &:hover { background: var(--mlo-bg-3); }

        &--active {
          background: rgba(179, 107, 255, 0.08);
          box-shadow: inset 2px 0 0 var(--mlo-accent);
        }
      }

      &__dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--mlo-dot-color, var(--mlo-accent));
        box-shadow: 0 0 6px var(--mlo-dot-color, var(--mlo-accent));
      }

      &__count { color: var(--mlo-fg-4); font: 500 10px var(--font-mono); }
      &__query {
        padding: 0 10px 6px 25px;
        color: var(--mlo-accent-2);
        font: 500 10px var(--font-mono);
      }
    }
  }

  .mlo-main {
    grid-row: 2;
    padding: 20px 24px 40px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .mlo-pagehead {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;

    &__title {
      margin: 0;
      color: var(--fg-1);
      font: 600 22px/1.1 "Space Grotesk", var(--font-ui);
      letter-spacing: -0.01em;

      &--dim { color: var(--mlo-fg-3); font-weight: 500; }
    }

    &__meta {
      margin: 4px 0 0;
      color: var(--mlo-fg-3);
      font: 500 12px var(--font-mono);
    }

    &__actions { display: flex; gap: 10px; }
  }

  .mlo-btn {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border: 1px solid var(--mlo-line-soft);
    border-radius: 6px;
    background: var(--mlo-bg-3);
    color: var(--fg-1);
    cursor: pointer;
    font: 500 12px var(--font-ui);
    gap: 6px;

    &--primary {
      border: 0;
      background: linear-gradient(180deg, #b36bff, #9355ef);
      box-shadow: 0 0 0 1px rgba(179, 107, 255, 0.3), 0 0 16px -2px rgba(179, 107, 255, 0.5);
      color: #fff;
    }

    &--icon { padding: 6px 10px; }
  }

  .mlo-body {
    display: flex;
    gap: 16px;
    min-width: 0;
  }

  .mlo-body__left { flex: 1; min-width: 0; }
  .mlo-body__right { width: 280px; flex-shrink: 0; }

  .mlo-section {
    margin-bottom: 16px;
    padding: 16px 18px;
    border: 1px solid var(--mlo-line-soft);
    border-radius: 10px;
    background: var(--mlo-bg-2);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.3));
  }

  .mlo-section-head {
    display: flex;
    align-items: baseline;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--mlo-hairline);
    margin-bottom: 12px;
    color: var(--fg-1);
    font: 600 15px "Space Grotesk", var(--font-ui);
    gap: 10px;

    &__hint { color: var(--mlo-fg-4); font: 500 10px var(--font-mono); }
  }

  .mlo-album-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .mlo-album-card {
    &__cover {
      position: relative;
      aspect-ratio: 1;
      border-radius: 4px;
      overflow: hidden;

      img { width: 100%; height: 100%; object-fit: cover; display: block; }

      &::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.6));
        opacity: 0;
        transition: opacity 0.12s ease-out;
        pointer-events: none;
      }
    }

    &__pill {
      position: absolute;
      right: 6px;
      bottom: 6px;
      padding: 2px 7px;
      border: 1px solid var(--mlo-line-soft);
      border-radius: 3px;
      background: rgba(7, 7, 12, 0.8);
      color: var(--mlo-fg-3);
      font: 500 10px var(--font-mono);
      z-index: 2;
    }

    &__play {
      position: absolute;
      right: 8px;
      bottom: 32px;
      width: 38px;
      height: 38px;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(180deg, #b36bff, #9355ef);
      box-shadow: 0 0 14px -2px rgba(179, 107, 255, 0.6);
      color: #fff;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.12s;
      z-index: 2;
    }

    &__cover:hover {
      &::after { opacity: 1; }
      ~ * .mlo-album-card__play, .mlo-album-card__play { opacity: 1; }
    }

    &__title {
      display: -webkit-box;
      max-width: 100%;
      margin-top: 8px;
      overflow: hidden;
      color: var(--fg-1);
      font: 600 13px var(--font-ui);
      text-decoration: none;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__artist {
      display: block;
      margin-top: 2px;
      color: var(--mlo-accent-2);
      font: 500 12px var(--font-ui);
      text-decoration: none;
    }

    &__meta {
      display: flex;
      margin-top: 4px;
      color: var(--mlo-fg-3);
      font: 500 11px var(--font-mono);
      gap: 6px;
    }

    &__plays { color: var(--mlo-accent-2); }
    &__tags { display: flex; flex-wrap: wrap; margin-top: 6px; gap: 4px; }
  }

  .mlo-tag-chip {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border: 1px solid rgba(124, 127, 255, 0.25);
    border-radius: 3px;
    background: rgba(124, 127, 255, 0.1);
    color: var(--mlo-accent-2);
    font: 500 10px var(--font-mono);
  }

  .mlo-song-table {
    .mlo-song-row {
      display: grid;
      width: 100%;
      align-items: center;
      padding: 8px 6px;
      border: 0;
      border-bottom: 1px solid var(--mlo-hairline);
      background: transparent;
      color: var(--fg-2);
      cursor: pointer;
      font: 500 12px var(--font-ui);
      gap: 12px;
      grid-template-columns: 32px 1.6fr 1.4fr 1.4fr 80px 50px 50px 60px;
      text-align: left;

      &:hover { background: rgba(179, 107, 255, 0.04); }

      &--head {
        cursor: default;
        color: var(--mlo-fg-4);
        font: 500 10px var(--font-mono);
        letter-spacing: 0.1em;
        text-transform: uppercase;

        &:hover { background: transparent; }
      }

      &--playing {
        background: rgba(179, 107, 255, 0.1);
        box-shadow: inset 2px 0 0 var(--mlo-accent);

        .mlo-song-row__title { color: var(--mlo-accent); }
      }

      &__num { display: flex; align-items: center; justify-content: center; color: var(--mlo-fg-4); font: 500 10px var(--font-mono); }
      &__num-text { transition: opacity 0.1s; }
      &__play-icon { display: none; }

      &:hover &__num-text { display: none; }
      &:hover &__play-icon { display: inline; color: var(--mlo-accent); }

      &--playing &__num-text { display: none; }

      &__title { color: var(--fg-1); font-weight: 500; }
      &__artist, &__album { color: var(--mlo-accent-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      &__plays { color: var(--mlo-accent-2); font: 500 12px var(--font-mono); text-align: right; }
      &__year, &__length { color: var(--mlo-fg-3); font: 500 11px var(--font-mono); text-align: right; }
      &__stars { display: inline-flex; gap: 1px; }
    }
  }

  .mlo-star {
    border: 0;
    background: transparent;
    color: var(--mlo-fg-disabled, #3a3e4b);
    cursor: pointer;
    font-size: 11px;
    line-height: 1;

    &--filled { color: var(--mlo-warn); }
  }

  .mlo-featured {
    margin-bottom: 16px;
    padding: 16px 18px;
    border: 1px solid var(--mlo-line-soft);
    border-radius: 10px;
    background: var(--mlo-bg-2);

    &__cover { width: 100%; max-width: 224px; aspect-ratio: 1; border-radius: 6px; object-fit: cover; }
    &__title { display: block; margin-top: 12px; color: var(--fg-1); font: 600 16px "Space Grotesk", var(--font-ui); text-decoration: none; }
    &__artist { display: block; margin-top: 2px; color: var(--mlo-accent-2); font: 500 13px var(--font-ui); text-decoration: none; }
    &__actions { display: flex; gap: 8px; margin-top: 12px; }
    &__actions .mlo-btn--primary { flex: 1; justify-content: center; }
  }

  .mlo-recent-plays {
    padding: 16px 18px;
    border: 1px solid var(--mlo-line-soft);
    border-radius: 10px;
    background: var(--mlo-bg-2);

    &__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
    &__row { display: grid; gap: 10px; grid-template-columns: 24px 1fr; }
    &__idx { color: var(--mlo-fg-4); font: 500 10px var(--font-mono); }
    &__title { color: var(--fg-1); font: 500 13px var(--font-ui); }
    &__artist { color: var(--mlo-accent-2); font: 500 12px var(--font-ui); text-decoration: none; }
  }
```

- [ ] **Step 2: Build the bundle**

```bash
cd bordercore && npm run vite:build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 3: Smoke‑test in the browser**

Start the Django dev server, log in, visit `/music/`. Confirm:

- Page renders with a 240px sidebar, page‑head, stat strip, album grid + song
  table, right rail with featured + recent plays.
- ⌘K focuses the search; typing filters album cards and rows.
- Clicking a smart playlist hides the album grid and shows playlist songs.
- Clicking a song row plays it (jinke player appears).
- Currently‑playing row gets the accent tint after `audio-play`.

If something doesn't match the design, fix it inline (the SCSS is a live
target — minor adjustments expected).

- [ ] **Step 4: Run the full test suite**

```bash
cd bordercore && npx vitest run
.venv/bin/python -m pytest bordercore/music/tests -v
```

Expected: passes (modulo unrelated pre‑existing failures noted in memory:
`test_data.py` lacks `django_db`).

- [ ] **Step 5: Commit**

```bash
script -qc "git add bordercore/static/scss/pages/_music-library-os.scss && git commit -m 'Style Library OS dashboard to match handoff design'" /dev/null
```

---

## Self-review

- **Spec coverage:** every spec section maps to a task — services (Tasks 1–3,
  6), view + template (Task 4), types (Task 5), helper (Task 7), styling
  scaffold + finish (Tasks 8 & 17), components (Tasks 9–15), page integration
  (Task 16). ✅
- **Placeholders:** none — every step contains the actual code or command. ✅
- **Type consistency:** `RecentAlbum` (Task 5), `RecentAddedSong` (Task 5),
  `DashboardStats` (Task 5), `PlaylistSidebarItem` (Task 5) used consistently
  across components. ✅
- **Risks called out in spec** (font availability, no Song.plays field,
  inline‑style lint rule for the playlist dot) appear in‑task with fallbacks. ✅
