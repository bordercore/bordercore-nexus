# Collections Landing v2 — Density Slider

## Overview

Replace the existing Favorites / Collections landing page (`/collection/`) with the v2 density-slider design from `design_handoff_landing_v2_density_slider/README.md`. The visual/behavior spec is the README; this document covers how that design integrates with the existing Django + React + SCSS codebase.

The current page (`CollectionListView` → `CollectionListPage.tsx`) is a thin filterable card grid. It is replaced in place — no feature flag, no parallel URL.

## Scope

In:
- New page chrome: topbar carryover, tag rail, page head, action cluster, density slider, four density-mode layouts (compact / grid / mosaic / cinema).
- Backend context expansion: expose `description`, `tags`, `modified`, `cover_tiles`, plus `tag_counts` for the rail.
- Frontend rewrite of `CollectionListPage.tsx` and supporting components.
- SCSS rewrite of `_collections.scss` under a new `.cl-shell` namespace using existing `--bc-*` tokens.
- Vitest unit tests for filter composition and density persistence.
- Wiring `+ new` to the existing `CreateCollectionModal`.

Out:
- Mobile rail-collapse below 720px (basic auto-fill responsive on cards only — defer rail-to-topbar).
- Wiring shuffle / edit / more icon buttons (visual no-ops per spec).
- Favorite-star toggle (read-only per spec).
- Backend caching of `cover_tiles` (computed per request; revisit if list grows large).

## Backend

**File:** `bordercore/collection/views.py:44` (`CollectionListView`)

Extend `get_queryset()` to prefetch the data the new context needs:

```python
query = query.prefetch_related(
    "tags",
    "collectionobject_set__blob",
)
```

Extend `get_context_data()` to emit a richer per-collection record and a tag-count map. The existing `collection_list` JSON shape changes to:

```python
{
    "uuid": str(c.uuid),
    "name": c.name,
    "url": reverse("collection:detail", kwargs={"uuid": c.uuid}),
    "num_objects": c.num_blobs,                              # renamed
    "description": c.description or "",
    "tags": list(c.tags.values_list("name", flat=True)),
    "modified": humanize.naturaltime(c.modified),            # "2 hours ago"
    "is_favorite": c.is_favorite,
    "cover_tiles": _build_cover_tiles(c),                    # ≤4 URLs, null-padded
}
```

`_build_cover_tiles(collection)` consumes `collection.get_recent_images()` and maps each `{uuid, file}` row to the blob's small-thumbnail S3 URL (matching the path `Blob.cover_url_small` produces). The returned list is right-padded with `None` to length 4 so the React mosaic does not need to defensively branch.

A second context key, `tag_counts: dict[str, int]`, is computed in Python from the prefetched tag rows so the rail does not have to recount on every React render.

Both `collection_list` and `tag_counts` are exposed to JS via `json_script`.

**Why prefetch:** without it, `tags` and the `get_recent_images()` query each issue per-collection lookups — N+1 against ~20 favorites times ~5 queries is enough to feel sluggish.

## Data shape (server → JS)

```ts
type Collection = {
  uuid: string;
  name: string;
  url: string;
  num_objects: number;
  description: string;
  tags: string[];
  modified: string;          // humanized: "2 hours ago"
  is_favorite: boolean;
  cover_tiles: (string | null)[];   // length 4, null = empty placeholder
};

type TagCounts = Record<string, number>;
```

`types.ts` is updated to match. The old `Collection` shape (with `num_blobs` and single `cover_url`) is removed — nothing else consumes it.

## Frontend

**Directory:** `bordercore/front-end/react/collection/`

`CollectionListPage.tsx` is rewritten as the page shell that owns three pieces of state:

```ts
density: "compact" | "grid" | "mosaic" | "cinema"  // default "grid"
activeTag: string | null                            // default null
searchQuery: string                                 // default ""
```

`density` is persisted in `localStorage["bordercore.collections.density"]` and rehydrated on mount; invalid values fall back to `"grid"`. `activeTag` and `searchQuery` are session-only.

The page derives a memoized `filtered` list (search × tag, both case-insensitive, AND composition) and renders the layout matching `density`.

**New components, all in `front-end/react/collection/`:**

| File | Purpose |
|---|---|
| `TagRail.tsx` | Left sidebar: section label, tag-name filter input, "all collections" row, one button per tag (sorted by descending count), footer block. |
| `ActionCluster.tsx` | Right side of the page head: search pill, density slider, four icon buttons (`+ new` is the only wired one). |
| `DensitySlider.tsx` | The headline `<input type="range">` with stop-name label, count, and `aria-valuetext`. |
| `CoverMosaic.tsx` | 2×2 tile grid; renders `<img>` tiles for present URLs and a placeholder class for missing ones. |
| `TagChip.tsx` | Themed pill — applies a `cl-tag-color-{slug}` class for known tags, `cl-tag-color-default` otherwise. |
| `CompactRow.tsx` | One row in compact density. |
| `GridCard.tsx` | Card used by both `grid` and `mosaic` densities; a `mosaic` prop toggles description visibility and aspect ratio. |
| `CinemaCard.tsx` | Hero card with overlay title + description. |
| `tagColors.ts` | `TAG_COLORS` map (name → hex). Single source of truth for known tag colors. |

Existing `CollectionCard.tsx` is removed (replaced by the new card variants). `CreateCollectionModal.tsx` is reused as-is — `ActionCluster` opens it via the same ref pattern the current page uses.

**No `style={}` anywhere.** The reference JSX uses inline styles for tag colors and mosaic backgrounds; `test_general.py::test_html` rejects those, so every dynamic visual is a class.

- **Tag chips, rail swatches, dot glows:** one SCSS class per known tag (`.cl-tag-color-cyberpunk`, `.cl-tag-color-fitness`, …), generated from a single SCSS map. Each class sets the chip background, border, text color, and dot color from one source. Unknown tags get `.cl-tag-color-default` (falls back to `--bc-accent-2`). `tagColors.ts` mirrors the map name list so React can pick the right class; the SCSS map is the visual source of truth.
- **Mosaic tiles:** rendered as `<img loading="lazy">` inside a tile wrapper, not a `background-image` div. Empty tiles render an empty `<div class="cl-mosaic-tile cl-mosaic-tile-empty">` for the diagonal-stripe placeholder.

## SCSS

**File:** `bordercore/static/scss/pages/_collections.scss`

Replace contents wholesale under a new `.cl-shell` root. Old rules (`.collection-container`, `.collection`, `.collection-item`, `.sortable-collection-grid-item`, etc.) are list-page-only — verified by reading the file. None survive in the new design.

`bordercore.scss` import remains unchanged. Tokens come from the existing `:root --bc-*` block already defined in `_refined-topbar.scss` — no new theme work.

The four density layouts use `[data-density="..."]` attribute selectors on `.cl-grid-v2`. Component swap (rows vs cards) is done in JSX, not CSS — only the wrapper grid template differs.

## Entry point and template

**`bordercore/front-end/entries/collection-list.tsx`** reads the new shape:
```ts
const collections: Collection[] = JSON.parse(...)
const tagCounts: TagCounts = JSON.parse(document.getElementById("tag-counts-data")?.textContent ?? "{}")
```
and passes both into `<CollectionListPage>`.

**`bordercore/templates/collection/collection_list.html`** adds one line:
```html
{{ tag_counts|json_script:"tag-counts-data" }}
```

The `data-create-collection-url` and `data-tag-search-url` attributes stay (still needed by the create modal).

## Tests

**Vitest** (`bordercore/front-end/react/collection/__tests__/` — new directory):

1. `filter.test.ts` — pure helper test: filter composition (search-only, tag-only, both, neither, case-insensitivity, name-vs-description match).
2. `density.test.ts` — `localStorage` round-trip: rehydrate honors saved value, invalid value falls back to `grid`, valid range stops persist.

Co-locating tests in `__tests__` matches existing patterns in the repo. No React render tests for the page itself — those add maintenance churn for limited value while the design is still settling.

**Backend smoke test** in `bordercore/collection/tests/test_views.py` (existing file): verify `CollectionListView.get_context_data()` returns a list whose first entry has the new keys (`description`, `tags`, `modified`, `cover_tiles`, `num_objects`) and that `tag_counts` is a dict.

## Risks and trade-offs

- **`cover_tiles` cost.** Even with prefetch, building 4 image URLs per collection adds work to the list-page render. For ~20 favorites the cost is negligible; if the page later supports non-favorites (hundreds of rows) this should be denormalized onto `Collection` or cached.
- **Tag color drift.** TAG_COLORS lives in TS only — if the user adds a new tag, it inherits the default purple until the map is updated. Acceptable: the fallback is on-brand. Long-term solution is a color column on `Tag`, deferred.
- **Replace-in-place blast radius.** Old `_collections.scss` rules and `CollectionCard.tsx` are deleted. If any other template references `.collection-container` etc., it will break. Implementation step 1 greps the codebase to confirm.

## Acceptance criteria

- `/collection/` renders the new design at all four density stops.
- Density stop persists across reloads via localStorage.
- Search and tag rail filters compose (AND) and operate case-insensitively over name + description.
- `+ new` opens the existing `CreateCollectionModal`.
- All four icon buttons render; only `+ new` is wired.
- Card / row hover states match the spec (translateY, purple glow).
- No `style={}` props in any new `.tsx` file (`test_general.py::test_html` passes).
- Vitest unit tests pass.
- Existing pages unaffected (other refined pages, collection detail).
