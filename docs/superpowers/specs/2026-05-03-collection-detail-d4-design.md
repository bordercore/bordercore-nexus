# Collection Detail — Direction 04 (Curatorial Grid)

Reference: `design_handoff_collection_detail_d4/README.md` (visual spec, full-fidelity).
Status: design approved 2026-05-03 (alignment over 4 review messages).

## Goal

Replace the current collection-detail page (`CollectionDetailPage` rendered by
the `collection.CollectionDetailView` Django view) with the D4 "Curatorial
Grid" layout from the handoff. The new layout is a two-column shell with a
collapsible tag rail on the left and a density-controlled grid on the right,
where each tile carries persistent metadata (name, type icon, optional note,
first 3 tags) and reveals chrome (drag handle, position number, edit, remove)
on hover.

The redesign is drop-in: same Django view, same context (`collection_data`,
`object_tags`, `initial_tags`), same backend endpoints. All changes are in the
React layer and SCSS.

## Decisions (from brainstorming)

1. **Preserve all existing features.** The handoff doesn't mention slideshow,
   file-drop upload, delete-collection, or pagination — but those are real
   features in the current app and will be kept. Slideshow + delete go behind
   a small "more" menu in the toolbar; file-drop stays on the grid; pagination
   becomes infinite scroll.
2. **Infinite scroll, not pages.** D4 reads as a single curatorial canvas;
   prev/next page buttons fight the design. Use an `IntersectionObserver`
   sentinel to load page 2/3/… and append to the rendered list. No backend
   changes — `get_object_list` already paginates at 30/page.
3. **No DB schema or migration changes; one small serializer change.** Existing
   endpoints already cover every D4 interaction (`get_object_list` with `?tag=`
   and `?random_order=true`, `sort_objects`, `remove_object`, `add_object`,
   `update_object_note`, `create_blob`). The one model-layer change is
   adding a `tags` field to `CollectionObject.get_properties()` — see "Backend
   prerequisite" below.
4. **Map handoff `--bc-*` tokens onto existing refined tokens** rather than
   importing the handoff's `colors_and_type.css`. The codebase already has
   Inter, JetBrains Mono, and the `--fg-*`/`--bg-*`/`--accent` system in every
   theme. D4 will render in dark/light/purple/cyberpunk/cobalt-abyss
   automatically.
5. **Add Space Grotesk** (the only handoff font not already loaded) via the
   existing font-loading approach. Used only for the collection title (h1).
6. **Replace hardcoded `rgba(179,107,255,…)` with `--accent`-derived
   equivalents** so the active-tag chip and count pill stay correct in
   non-purple themes.

## Architecture

### React layer

Files under `bordercore/front-end/react/collection/`:

- **New:** `CurateCollectionPage.tsx` — top-level D4 layout shell. Replaces the
  body of `CollectionDetailPage.tsx` but keeps the same modal refs and
  handlers (slideshow, edit-collection, delete-collection, image-view).
- **New:** `CurateRail.tsx` — left rail. `tags` micro-label, collapse toggle,
  search input, "all objects" entry, scrollable tag list. Tag click navigates
  to `?tag=foo`; collapsed state persists to `localStorage`.
- **New:** `CurateHeader.tsx` — sticky page header. Breadcrumb (`Collections /
  {name}`), `<h1>` with count pill, description, right-side toolbar (density
  slider, shuffle, edit, add, more-menu).
- **New:** `CurateGrid.tsx` — wraps `<DndContext>` + `<SortableContext>`,
  retains the `onDrop`/`onDragOver` file-drop handlers from the existing
  `CollectionObjectGrid`. Renders an `IntersectionObserver` sentinel for
  infinite scroll. Empty/loading states render here.
- **New:** `CurateTile.tsx` — single tile. Thumb (real `<img>` for blobs,
  bookmark hero card for bookmarks), chrome bar (drag handle, position
  number, edit, remove), meta block (name + type icon, note, mini tags).
- **Removed:** `CollectionObjectGrid.tsx` (functionality split between
  `CurateGrid` and `CurateTile`).
- **Removed:** `CollectionDetailPage.tsx` (replaced by `CurateCollectionPage`).
- **Kept:** `EditCollectionModal`, `DeleteCollectionModal`, `SlideShowModal`,
  `SlideShowOverlay`, `ImageViewModal` — wired in from
  `CurateCollectionPage`. Same props/contracts as today.

Entry file `bordercore/front-end/entries/collection-detail.tsx` swaps
`CollectionDetailPage` for `CurateCollectionPage`. Same data-attribute reads,
same JSON-script reads.

### Backend / Django

No changes to `collection/models.py`, `collection/views.py`, `collection/urls.py`,
or `collection/forms.py`. The template
`bordercore/templates/collection/collection_detail.html` stays as-is — it
already passes the right context, the right data attributes, and the right
Vite asset.

### SCSS

- **New:** `bordercore/static/scss/pages/_collection-detail-curate.scss`,
  namespace `.cd-curate`. Contains all D4-specific styles (shell grid, rail,
  header, density slider, grid, tile, chrome, meta, mini-tags, drag glow,
  empty/loading skeletons).
- **Updated:** `bordercore/static/scss/bordercore.scss` — `@import
  "pages/collection-detail-curate"` after the existing
  `pages/collections` import.
- **Kept:** `_collections.scss` still drives `CollectionListPage`. None of its
  rules apply to the new detail page (different namespace).
- **Updated (each theme):** Add a single new var `--accent-bookmark` for the
  bookmark type-icon color in `_theme-dark.scss`, `_theme-light.scss`,
  `_theme-purple.scss`, `_theme-cyberpunk.scss`, `_theme-cobalt-abyss.scss`.

### Fonts

- **Inter, JetBrains Mono:** already loaded by the global theme.
- **Space Grotesk:** add via Google Fonts import at the top of
  `_collection-detail-curate.scss`. Precedent:
  `_exercise-detail-refined.scss:12` does the same.
  ```scss
  @import "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600&display=swap";
  ```
  Define `--cd-font-display` scoped to `.cd-curate` (not in the theme files —
  page-local). Used only by `.cd-curate h1`.

## State

All state lives in `CurateCollectionPage`. Sub-components are presentational
where possible.

```ts
objects: CollectionObject[];          // canonical render order; shuffle mutates this
paginator: PaginatorInfo | null;      // from the most recent fetch
loadingMore: boolean;                 // infinite-scroll guard
columns: 3 | 4 | 5 | 6;               // density slider; localStorage persisted
railOpen: boolean;                    // left-rail expanded; localStorage persisted (global)
tagSearch: string;                    // case-insensitive filter on rail tag list
shuffled: boolean;                    // gates drag + infinite scroll
```

`objects` is the single source of render order. Shuffle replaces it with a
Fisher-Yates copy and flips `shuffled`. Reloading or changing tag refetches
from the server (canonical `sort_order`).

`activeTag` is **not** state — it's read from `?tag=` in the URL and is the
source of truth (matches existing pattern). Tag clicks navigate via
`window.location.href = ...?tag=...`.

### Persistence keys

| Key | Default | Notes |
|---|---|---|
| `bordercore.collection.<uuid>.density` | `4` | Per-collection density |
| `bordercore.collection.rail-open` | `true` | Global (matches sidebar UX expectation) |

### Derived

```ts
filteredTags = OBJECT_TAGS.filter(t => t.tag.toLowerCase().includes(tagSearch.toLowerCase()));
```

## Data flow

### Initial load
On mount, `CurateCollectionPage` calls `GET {urls.getObjectList}?pageNumber=1`
(plus `&tag=...` if URL has `?tag=`). Response populates `objects` and
`paginator`.

### Infinite scroll
A `<div ref={sentinelRef}>` is rendered after the last tile. An
`IntersectionObserver` (instantiated in a `useEffect`) watches the sentinel.
On intersection, if `paginator.has_next && !loadingMore && !shuffled`, fetch
`pageNumber + 1` with the same `tag` filter, append to `objects`, update
`paginator`. Observer is cleaned up on unmount.

### Drag-reorder
`@dnd-kit/sortable`'s `onDragEnd` fires with `active.id` and `over.id` (both
`CollectionObject.uuid`). Compute `oldIndex` and `newIndex` in `objects`. Move
the item locally (`arrayMove`), then POST `{collection_uuid, object_uuid,
new_position: newIndex + 1}` to `urls.sortObjects`. The endpoint takes a
1-indexed absolute position; since infinite-scroll loads contiguous pages from
the start, `newIndex + 1` is the correct absolute value. On failure, revert
the local move and `console.error` (matches the existing
`CollectionDetailPage` error pattern — no toast system in the codebase).

Drag is disabled while `shuffled === true` via `useSortable({ disabled:
shuffled })` on each item. Visual cue: drag handle dims to `--fg-4`.

### Tag filter
Rail tag click → `window.location.href = pathname + (tag ? '?tag=' + encoded :
'')`. Page reloads. `activeTag` is whatever's in the URL.

Clicking the active tag again → navigate to pathname with no query (clears
filter). Clicking "all objects" → same.

### Tag search (rail filter input)
Local state `tagSearch`. Filters the visible tag list by case-insensitive
substring. Does not hit the server.

### Density slider
3–6 cols, persisted per-collection. Drives inline `gridTemplateColumns:
repeat(${columns}, 1fr)` on `.cd-curate-grid`. No fetch, no layout thrash.

### Shuffle
Client-side Fisher-Yates of `objects`. Sets `shuffled = true`. Disables drag
and pauses infinite scroll until cleared. Cleared by:
- Clicking shuffle again
- Tag change (page reload clears it)
- Page reload

### Per-tile remove
Confirm dialog (`window.confirm` for now — matches codebase pattern). On
confirm, POST to `urls.removeObject`, then drop the item from `objects` and
decrement `paginator.count`.

### Per-tile edit
Direct `<a>` link to `/blob/<uuid>/update/` (blob) or
`/bookmark/<uuid>/update/` (bookmark). No modal — matches how object editing
works elsewhere in the app.

### Per-tile click targets

| Click target | Behavior |
|---|---|
| Drag handle | Initiates drag (handled by `@dnd-kit`'s `listeners`) |
| Position number | No-op (display only) |
| Edit button | Navigates to object's update page |
| Remove button | Confirm + remove |
| Thumb area | Blob → opens `ImageViewModal`. Bookmark → opens URL in new tab. |
| Name link | Navigates to detail page (`/blob/<uuid>/` or bookmark URL) |
| Mini-tag (`#foo`) | Filters by that tag (navigates to `?tag=foo`) |

### File-drop on grid
Existing behavior preserved. Drag a file onto the grid → POST to
`urls.createBlob`, redirect to the new blob's detail page.

### Toolbar buttons (right side of header)

| Button | Action |
|---|---|
| Density slider (3–6 cols) | Updates `columns` state, persists to localStorage |
| Shuffle (`fa-shuffle`, ghost) | Client-side Fisher-Yates; toggles `shuffled` |
| Edit (`fa-pencil-alt`, ghost) | Opens `EditCollectionModal` |
| Add (`fa-plus`, primary) | Navigates to `/blob/create/?collection_uuid=<uuid>` |
| More (`fa-ellipsis-h`, ghost) | Dropdown: Slideshow, Delete |

The "more" menu uses the existing `DropDownMenu` component pattern.

## Empty / loading states

- **No items in collection** (`paginator.count === 0`, no tag filter):
  centered message in main column, `--fg-3` 14px, with the "add" CTA button.
- **No items match active tag** (`paginator.count === 0`, `activeTag` set):
  centered message "No items tagged `{tag}`", with a clear-filter link styled
  like the breadcrumb link.
- **Initial load** (objects null, fetching page 1): 8 skeleton tiles matching
  current density. Same dimensions as `.cd-curate-tile`, replace thumb + meta
  with `--bg-3` blocks at 50% opacity.
- **Loading next page**: 4 inline skeleton tiles at the bottom of the grid
  while page N+1 is in flight.

## Token mapping

Defined in `_collection-detail-curate.scss` either as scoped overrides on
`.cd-curate` or via direct token reference in selectors.

| Handoff token | Existing token | Notes |
|---|---|---|
| `--bc-bg-0` | `--bg-0` | page bg |
| `--bc-bg-1` | `--bg-1` | search input bg |
| `--bc-bg-2` | `--bg-2` | tile bg, density slider pill |
| `--bc-bg-3` | `--bg-3` | default button bg |
| `--bc-bg-4` | `color-mix(in oklch, var(--bg-3), var(--fg-2) 8%)` | button hover bg |
| `--bc-fg-1` | `--fg-0` (h1, name leaf) / `--fg-1` (body) | h1 uses brightest |
| `--bc-fg-2` | `--fg-2` | drag handle, tag-button text |
| `--bc-fg-3` | `--fg-3` | description, count readout, note, mini-tags |
| `--bc-fg-4` | `--fg-4` | tag-list count, "untitled" text |
| `--bc-accent` | `--accent` | count pill, active dot, slider thumb, drag glow |
| `--bc-accent-4` | `--accent-bookmark` (new theme var) | bookmark type icon |
| `--bc-danger` | `--danger` | remove-button hover |
| `--bc-border-1` | `--line` | default border |
| `--bc-border-2` | `color-mix(in oklch, var(--line), var(--fg-2) 20%)` | hover border |
| `--bc-hairline` | `--line-soft` | header bottom border, thumb bottom border |
| `--bc-radius-md` | `--radius` | tiles (10px) |
| `--bc-glow-accent` | scoped: `0 0 0 1px var(--accent-soft), 0 0 24px -2px var(--accent-glow)` | drag glow |

Hardcoded `rgba(179,107,255,0.12)` → `var(--accent-soft)`.
Hardcoded `rgba(179,107,255,0.3)` → `color-mix(in oklch, var(--accent), transparent 70%)`.

## Edge cases & invariants

- **Drag during shuffle:** disabled via `useSortable({ disabled: shuffled })`.
  Tile chrome still shows the drag handle but it's inert; visual cue: handle
  dims to `--fg-4`.
- **Drag while next page is loading:** allowed. The next page appends to
  `objects` after the drag completes; absolute position math still works
  because pages are contiguous from the start.
- **Tag filter clears shuffle:** by virtue of the page reload.
- **Density change preserves scroll position:** by default — only
  `gridTemplateColumns` changes, so layout reflows in place.
- **Rail collapse animation:** 180ms on `grid-template-columns` only. Tag
  list, search box, and "tags" label hide via `display: none` triggered by a
  `.collapsed` class (no fade — matches the handoff).
- **Bookmark thumbs:** the existing `Bookmark.get_favicon_img_tag(size=16)`
  returns a small favicon. For the tile thumb, render a "hero card" — a
  centered favicon (32px) over a subtle gradient using the favicon's dominant
  hue, on a 4:3 surface. Falls back to a generic `fa-link` glyph if no
  favicon. (Mirrors the feed page's `.tp-feed-favicon` pattern in
  `_feed.scss`.)
- **`note` rendering:** `CollectionObject.note` is plain text. Render with
  `white-space: pre-wrap`. No markdown.
- **Untitled items:** when `name` is empty/whitespace, render literal text
  "untitled" with class `.empty` (italic, `--fg-4`).
- **Tags on tile:** show first 3 from the blob/bookmark's tag list. The
  existing serializer in `CollectionObject.get_properties()` does NOT return
  tags today — see "Backend prerequisite" below.

## Backend prerequisite

`CollectionObject.get_properties()` currently returns `uuid`, `name`,
`filename`, `cover_url`, `cover_url_large`, `favicon_url`, etc. — but **not**
the object's tags. D4 needs the first 3 tags per item for the tile meta block.

**Add to `get_properties()`:** a `tags` field, populated as
`list(self.blob.tags.values_list('name', flat=True)[:3])` for blobs and
`list(self.bookmark.tags.values_list('name', flat=True)[:3])` for bookmarks.
Use `.prefetch_related('blob__tags', 'bookmark__tags')` in
`get_object_list()` to avoid N+1.

This is the only model/serializer change in the project.

## Server interactions (no API changes)

| Action | Endpoint | Method |
|---|---|---|
| Initial fetch / pagination | `urls.getObjectList?pageNumber=N&tag=…` | GET |
| Reorder | `urls.sortObjects` | POST `{collection_uuid, object_uuid, new_position}` |
| Remove tile | `urls.removeObject` | POST `{collection_uuid, object_uuid}` |
| File-drop upload | `urls.createBlob` | POST multipart |
| Edit collection | `urls.updateCollection` | (existing modal) |
| Delete collection | `urls.deleteCollection` | (existing modal) |
| Slideshow images | `urls.getBlob?...` | GET (existing) |

## Testing

Existing Django tests cover the backend endpoints; this redesign doesn't change
their contracts. Run the existing suite to confirm no regressions:

```
make test
```

Frontend changes are not covered by automated tests in the project. Manual
verification (per repo convention for UI-only redesigns):

1. Load a collection with images + bookmarks. Verify D4 layout renders.
2. Toggle rail collapse → grid template animates to 48px column.
3. Drag the density slider → grid reflows 3↔4↔5↔6 cols. Refresh → density
   persists.
4. Click a tag → URL gains `?tag=foo`, grid filters, count pill updates.
5. Click the active tag again → filter clears.
6. Drag a tile to a new position → reorders, persists. Refresh → order
   preserved.
7. Click shuffle → order randomizes. Drag handles dim. Reload → shuffle
   gone.
8. Hover a tile → chrome fades in (120ms). Click thumb → image modal
   (blob) or new tab (bookmark).
9. Click remove → confirm → tile disappears, count decrements.
10. Drop a file on the grid → upload + redirect to new blob page.
11. Click "more" menu → slideshow + delete options work as today.
12. Empty collection / no-tag-match states render correctly.
13. Switch theme (dark / light / purple / cyberpunk / cobalt-abyss) → all
    states render correctly without hardcoded color regressions.
14. `test_general.py::test_html` passes (no inline styles in `*.tsx`,
    excluding the `gridTemplateColumns` setter on the grid container — verify
    that's allowed or use a CSS custom property instead).

### Inline-style note

Project convention forbids inline `style={...}` props in
`front-end/react/**/*.tsx` (per `test_general.py::test_html`). The density
grid needs a dynamic `grid-template-columns`. Solution: set a CSS custom
property via `ref` or via a class with N variants, **not** via `style={...}`.
Concretely:

```tsx
useLayoutEffect(() => {
  gridRef.current?.style.setProperty('--cd-cols', String(columns));
}, [columns]);
```

Plus `.cd-curate-grid { grid-template-columns: repeat(var(--cd-cols, 4), 1fr); }`
in the SCSS. This sidesteps the lint rule (the existing
`SortableCollectionItem` uses the same pattern for `--sortable-transform`).

## Out of scope (defer)

- Inline note editing (use the per-blob edit page for now)
- Tile selection / multi-select
- Bulk operations (move, tag, remove multiple)
- Keyboard navigation across the grid
- Reduced-motion media query (existing transitions are short enough)
- Mobile / narrow-viewport responsive treatment (handoff is 1440px desktop)
