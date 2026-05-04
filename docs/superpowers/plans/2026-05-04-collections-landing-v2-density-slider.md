# Collections Landing v2 — Density Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing `/collection/` favorites landing page with the v2 density-slider design — four layout modes driven by a slider, a tag rail, a search pill, and a richer per-collection record (description, tags, modified, cover tiles).

**Architecture:** Django view emits an extended JSON record (description, tags, modified, cover_tiles) plus a `tag_counts` map. React owns three pieces of state (density, activeTag, searchQuery) with density persisted to localStorage. Layout swaps are JSX-branched per density; styling lives in a wholesale-rewritten `_collections.scss` under a `.cl-shell` namespace using existing `--bc-*` design tokens.

**Tech Stack:** Django 5 + DRF, Python 3 (humanize), React 18 + TypeScript, SCSS, Vite 6, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-05-04-collections-landing-v2-density-slider-design.md`. The visual/behavior reference is `design_handoff_landing_v2_density_slider/README.md` — consult both for any visual ambiguity.

**Repo conventions confirmed by reading existing files:**
- Frontend tests are co-located (e.g. `boldenOption.test.ts`, `NewTodoModal.test.tsx`), not in `__tests__/` dirs. (The spec says `__tests__/` — ignore that; follow the repo.)
- Pre-commit hooks run mypy + lint-staged + a quality check. Wrap `git commit` in `script -qc "..." /dev/null` to give the hook a tty (snap-confine breaks `uv run` when stdout is piped).
- The `test_html` rule (`bordercore/tests/test_general.py`) flags any `style={...}` in `front-end/react/**/*.tsx`. Honor it strictly — no inline-style escape hatches.
- Existing tags `Collection.tags` is a M2M to `tag.Tag`; `Tag` has `name, is_meta, user, created` and **no color field**.
- `Blob.get_cover_url_static(uuid, filename, size="small")` returns the small-thumbnail S3 URL — what we want for mosaic tiles.
- `humanize` is already a runtime dep (used in `blob/services.py`, `blob/models.py`).

---

## File Structure

**Files created:**

| Path | Responsibility |
|---|---|
| `bordercore/front-end/react/collection/tagColors.ts` | TAG_COLORS map + `tagSlug()` helper. |
| `bordercore/front-end/react/collection/filter.ts` | Pure `filterCollections(collections, query, activeTag)` helper. |
| `bordercore/front-end/react/collection/filter.test.ts` | Vitest tests for filter composition. |
| `bordercore/front-end/react/collection/density.ts` | Density stops constant + load/save helpers. |
| `bordercore/front-end/react/collection/density.test.ts` | Vitest tests for localStorage round-trip. |
| `bordercore/front-end/react/collection/TagChip.tsx` | Themed pill component. |
| `bordercore/front-end/react/collection/CoverMosaic.tsx` | 2×2 image-tile component. |
| `bordercore/front-end/react/collection/DensitySlider.tsx` | Range input + stop label. |
| `bordercore/front-end/react/collection/TagRail.tsx` | Left sidebar with tag list. |
| `bordercore/front-end/react/collection/ActionCluster.tsx` | Right side of page head: search + slider + icon buttons. |
| `bordercore/front-end/react/collection/CompactRow.tsx` | One row in `compact` density. |
| `bordercore/front-end/react/collection/GridCard.tsx` | Card used by `grid` and `mosaic` densities. |
| `bordercore/front-end/react/collection/CinemaCard.tsx` | Hero card with overlay title. |

**Files modified:**

| Path | Change |
|---|---|
| `bordercore/collection/views.py` | Extend `CollectionListView.get_queryset` (prefetch) and `get_context_data` (new fields + tag_counts). |
| `bordercore/collection/tests/test_views.py` | Update `test_collection_list` to assert new context shape. |
| `bordercore/templates/collection/collection_list.html` | Add `{{ tag_counts|json_script:"tag-counts-data" }}`. |
| `bordercore/front-end/react/collection/types.ts` | Replace `Collection` shape, add `TagCounts`. |
| `bordercore/front-end/entries/collection-list.tsx` | Read new context shape + tag counts. |
| `bordercore/front-end/react/collection/CollectionListPage.tsx` | Wholesale rewrite as the new shell. |
| `bordercore/static/scss/pages/_collections.scss` | Wholesale rewrite under `.cl-shell` namespace. |

**Files deleted:**

| Path | Reason |
|---|---|
| `bordercore/front-end/react/collection/CollectionCard.tsx` | Replaced by new card variants. |

---

## Task 1: Backend — extend CollectionListView context

**Files:**
- Modify: `bordercore/collection/views.py:44-105`
- Test: `bordercore/collection/tests/test_views.py:19-26`

- [ ] **Step 1: Read the current view + test**

```bash
sed -n '40,110p' bordercore/collection/views.py
sed -n '15,30p' bordercore/collection/tests/test_views.py
```

- [ ] **Step 2: Update the test FIRST (TDD)**

In `bordercore/collection/tests/test_views.py`, replace the body of `test_collection_list` (currently lines 19-26):

```python
def test_collection_list(authenticated_client, collection):

    _, client = authenticated_client()

    url = urls.reverse("collection:list")
    resp = client.get(url)

    assert resp.status_code == 200
    assert resp.context["title"] == "Collection List"

    collection_list = resp.context_data["collection_list"]
    assert len(collection_list) == 2

    first = collection_list[0]
    assert "uuid" in first
    assert "name" in first
    assert "url" in first
    assert "num_objects" in first
    assert "description" in first
    assert "tags" in first
    assert "modified" in first
    assert "is_favorite" in first
    assert "cover_tiles" in first
    assert isinstance(first["tags"], list)
    assert isinstance(first["cover_tiles"], list)
    assert len(first["cover_tiles"]) == 4

    assert "tag_counts" in resp.context_data
    assert isinstance(resp.context_data["tag_counts"], dict)
```

- [ ] **Step 3: Run the test — confirm it fails**

```bash
.venv/bin/python3 -m pytest bordercore/collection/tests/test_views.py::test_collection_list -v
```

Expected: FAIL with `AssertionError: 'num_objects'` (or similar — the old shape has `num_blobs`).

- [ ] **Step 4: Update `views.py` imports**

Add at the top of `bordercore/collection/views.py` near the other imports:

```python
import humanize
```

- [ ] **Step 5: Replace `CollectionListView` body (lines 44-105)**

Replace the whole class with:

```python
class CollectionListView(LoginRequiredMixin, FormRequestMixin, FormMixin, ListView):
    """View for displaying the collection list page.

    Shows favorite collections for the current user with their blob counts,
    tags, recent images, and metadata. Supports filtering by collection name.
    """

    form_class = CollectionForm

    def get_queryset(self) -> QuerySet[Collection]:
        user = cast(User, self.request.user)
        query = Collection.objects.filter(
            user=user,
            is_favorite=True
        )

        if "query" in self.request.GET:
            query = query.filter(name__icontains=self.request.GET["query"])

        query = query.annotate(num_blobs=Count("collectionobject"))
        query = query.prefetch_related("tags", "collectionobject_set__blob")
        query = query.order_by("-modified")

        return query

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        context = super().get_context_data(**kwargs)

        collection_list = []
        tag_counts: dict[str, int] = {}

        for c in self.object_list:
            tag_names = [t.name for t in c.tags.all()]
            for name in tag_names:
                tag_counts[name] = tag_counts.get(name, 0) + 1

            collection_list.append({
                "uuid": str(c.uuid),
                "name": c.name,
                "url": reverse("collection:detail", kwargs={"uuid": c.uuid}),
                "num_objects": c.num_blobs,
                "description": c.description or "",
                "tags": tag_names,
                "modified": humanize.naturaltime(c.modified) if c.modified else "",
                "is_favorite": c.is_favorite,
                "cover_tiles": _build_cover_tiles(c),
            })

        context["collection_list"] = collection_list
        context["tag_counts"] = tag_counts
        context["cover_url"] = settings.COVER_URL
        context["title"] = "Collection List"

        return context


def _build_cover_tiles(collection: Collection) -> list[str | None]:
    """Build a 4-element list of recent-image URLs for a collection.

    Returns up to 4 small-thumbnail blob URLs, right-padded with None.
    """
    tiles: list[str | None] = []
    for image in collection.get_recent_images(limit=4):
        tiles.append(Blob.get_cover_url_static(image["uuid"], image["file"], size="small"))
    while len(tiles) < 4:
        tiles.append(None)
    return tiles
```

- [ ] **Step 6: Run the test — confirm it passes**

```bash
.venv/bin/python3 -m pytest bordercore/collection/tests/test_views.py::test_collection_list -v
```

Expected: PASS.

- [ ] **Step 7: Run the full collection test suite to confirm nothing else broke**

```bash
.venv/bin/python3 -m pytest bordercore/collection/tests/ -v
```

Expected: all pass (or only pre-existing failures unrelated to our changes).

- [ ] **Step 8: Commit**

```bash
git add bordercore/collection/views.py bordercore/collection/tests/test_views.py
script -qc "git commit -m 'Extend CollectionListView context for v2 landing page

- Emit description, tags, modified (humanized), cover_tiles per collection.
- Rename num_blobs -> num_objects in the JSON shape.
- Add tag_counts map for the rail.
- Prefetch tags + collectionobject_set__blob to avoid N+1.'" /dev/null
```

---

## Task 2: Frontend — update types

**Files:**
- Modify: `bordercore/front-end/react/collection/types.ts:3-9`

The current `Collection` type is consumed by `CollectionListPage.tsx` and `CollectionCard.tsx` (both being rewritten/deleted) and `CurateCollectionPage.tsx` (separate page — uses `CollectionDetail`, not `Collection`, so unaffected). Verify before changing:

- [ ] **Step 1: Verify `Collection` type usage**

```bash
grep -rn "import.*Collection.*from.*types" bordercore/front-end/react/collection/
grep -rn "Collection\b" bordercore/front-end/react/collection/*.tsx | grep -v ":.*//"
```

Expected: only `CollectionListPage.tsx`, `CollectionCard.tsx`, and `entries/collection-list.tsx` reference the list-page `Collection` shape. (`CollectionDetail` is a separate type; leave it.)

- [ ] **Step 2: Replace the `Collection` type and add `TagCounts`**

In `bordercore/front-end/react/collection/types.ts`, replace lines 3-9:

```ts
export interface Collection {
  uuid: string;
  name: string;
  url: string;
  num_objects: number;
  description: string;
  tags: string[];
  modified: string;
  is_favorite: boolean;
  cover_tiles: (string | null)[];
}

export type TagCounts = Record<string, number>;
```

- [ ] **Step 3: Type-check**

```bash
npm --prefix bordercore run typecheck 2>&1 | head -40
```

Expected: errors in `CollectionListPage.tsx`, `CollectionCard.tsx`, `entries/collection-list.tsx` — these reference `num_blobs` / `cover_url`. That's expected; we're rewriting them in later tasks. **Do not commit yet** — we'll commit types together with the page rewrite (Task 11) so master never has a broken intermediate state.

---

## Task 3: Frontend — tag colors map and helpers

**Files:**
- Create: `bordercore/front-end/react/collection/tagColors.ts`

- [ ] **Step 1: Create the file**

```ts
// Source of truth for tag → color mapping (used by SCSS class generation
// and by React for picking the right modifier class).
//
// Keep in sync with the $tag-colors map in static/scss/pages/_collections.scss.

export const TAG_COLORS: Record<string, string> = {
  cyberpunk: "#b36bff",
  fitness: "#3fd29c",
  inspiration: "#f0b840",
  ui: "#4cc2ff",
  reference: "#7c7fff",
  food: "#ff5577",
  travel: "#3fd29c",
  art: "#ff3dbd",
  reading: "#f0b840",
  cosplay: "#ff3dbd",
  retro: "#7c7fff",
  workspace: "#4cc2ff",
  personal: "#b36bff",
  links: "#4cc2ff",
  research: "#7c7fff",
};

export const TAG_COLOR_DEFAULT = "#7c7fff";

/**
 * Return the SCSS-class slug for a tag, or "default" if the tag is not in
 * TAG_COLORS. Used to pick `.cl-tag-color-{slug}` on tag chips and rail rows.
 */
export function tagSlug(tagName: string): string {
  return tagName in TAG_COLORS ? tagName : "default";
}
```

- [ ] **Step 2: Type-check passes for this file**

```bash
npm --prefix bordercore run typecheck 2>&1 | grep -E "tagColors\.ts" || echo "no errors in tagColors.ts"
```

Expected: no errors in `tagColors.ts` (other files still error from Task 2 — that's fine).

- [ ] **Step 3: Commit**

```bash
git add bordercore/front-end/react/collection/tagColors.ts
script -qc "git commit -m 'Add tag colors map for v2 collections landing'" /dev/null
```

---

## Task 4: Frontend — filter helper with TDD tests

**Files:**
- Create: `bordercore/front-end/react/collection/filter.ts`
- Create: `bordercore/front-end/react/collection/filter.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `bordercore/front-end/react/collection/filter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterCollections } from "./filter";
import type { Collection } from "./types";

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    uuid: "1",
    name: "Sample",
    url: "/c/1",
    num_objects: 0,
    description: "",
    tags: [],
    modified: "now",
    is_favorite: true,
    cover_tiles: [null, null, null, null],
    ...overrides,
  };
}

describe("filterCollections", () => {
  it("returns all collections when query is empty and tag is null", () => {
    const cs = [makeCollection({ uuid: "1" }), makeCollection({ uuid: "2" })];
    expect(filterCollections(cs, "", null)).toHaveLength(2);
  });

  it("matches by name (case-insensitive)", () => {
    const cs = [
      makeCollection({ uuid: "1", name: "Cyberpunk Inspiration" }),
      makeCollection({ uuid: "2", name: "Travel Photos" }),
    ];
    expect(filterCollections(cs, "cyber", null).map(c => c.uuid)).toEqual(["1"]);
    expect(filterCollections(cs, "PHOTOS", null).map(c => c.uuid)).toEqual(["2"]);
  });

  it("matches by description", () => {
    const cs = [
      makeCollection({ uuid: "1", description: "Vintage poster art" }),
      makeCollection({ uuid: "2", description: "Modern UI examples" }),
    ];
    expect(filterCollections(cs, "vintage", null).map(c => c.uuid)).toEqual(["1"]);
  });

  it("filters by active tag", () => {
    const cs = [
      makeCollection({ uuid: "1", tags: ["cyberpunk", "art"] }),
      makeCollection({ uuid: "2", tags: ["food"] }),
    ];
    expect(filterCollections(cs, "", "cyberpunk").map(c => c.uuid)).toEqual(["1"]);
    expect(filterCollections(cs, "", "food").map(c => c.uuid)).toEqual(["2"]);
  });

  it("composes search and tag filter as AND", () => {
    const cs = [
      makeCollection({ uuid: "1", name: "Cyberpunk Art", tags: ["cyberpunk"] }),
      makeCollection({ uuid: "2", name: "Cyberpunk Music", tags: ["music"] }),
      makeCollection({ uuid: "3", name: "Renaissance Art", tags: ["cyberpunk"] }),
    ];
    expect(filterCollections(cs, "cyberpunk", "cyberpunk").map(c => c.uuid)).toEqual(["1"]);
  });

  it("returns empty when nothing matches", () => {
    const cs = [makeCollection({ uuid: "1", name: "Foo" })];
    expect(filterCollections(cs, "bar", null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
npm --prefix bordercore test -- filter.test.ts 2>&1 | tail -20
```

Expected: failure (`Cannot find module './filter'` or similar).

- [ ] **Step 3: Implement the helper**

Create `bordercore/front-end/react/collection/filter.ts`:

```ts
import type { Collection } from "./types";

/**
 * Filter collections by case-insensitive search query (matches name OR
 * description) AND optional active tag.
 */
export function filterCollections(
  collections: Collection[],
  query: string,
  activeTag: string | null,
): Collection[] {
  const q = query.trim().toLowerCase();
  return collections.filter(c => {
    if (activeTag && !c.tags.includes(activeTag)) return false;
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  });
}
```

- [ ] **Step 4: Run the tests — confirm they pass**

```bash
npm --prefix bordercore test -- filter.test.ts 2>&1 | tail -15
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add bordercore/front-end/react/collection/filter.ts bordercore/front-end/react/collection/filter.test.ts
script -qc "git commit -m 'Add filterCollections helper with tests'" /dev/null
```

---

## Task 5: Frontend — density persistence helper with TDD tests

**Files:**
- Create: `bordercore/front-end/react/collection/density.ts`
- Create: `bordercore/front-end/react/collection/density.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `bordercore/front-end/react/collection/density.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DENSITY_STOPS,
  loadDensity,
  saveDensity,
  densityFromIndex,
  indexFromDensity,
  STORAGE_KEY,
} from "./density";

describe("density stops", () => {
  it("has four ordered stops", () => {
    expect(DENSITY_STOPS).toEqual(["compact", "grid", "mosaic", "cinema"]);
  });
});

describe("indexFromDensity / densityFromIndex", () => {
  it("round-trips each stop", () => {
    DENSITY_STOPS.forEach((stop, i) => {
      expect(indexFromDensity(stop)).toBe(i);
      expect(densityFromIndex(i)).toBe(stop);
    });
  });

  it("clamps invalid indices to 'grid'", () => {
    expect(densityFromIndex(-1)).toBe("grid");
    expect(densityFromIndex(99)).toBe("grid");
  });
});

describe("loadDensity / saveDensity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns 'grid' as the default when storage is empty", () => {
    expect(loadDensity()).toBe("grid");
  });

  it("returns the saved value when it is a valid stop", () => {
    saveDensity("cinema");
    expect(loadDensity()).toBe("cinema");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("cinema");
  });

  it("falls back to 'grid' when the saved value is invalid", () => {
    localStorage.setItem(STORAGE_KEY, "junk");
    expect(loadDensity()).toBe("grid");
  });

  it("falls back to 'grid' when storage throws", () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error("blocked"); };
    try {
      expect(loadDensity()).toBe("grid");
    } finally {
      Storage.prototype.getItem = orig;
    }
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
npm --prefix bordercore test -- density.test.ts 2>&1 | tail -15
```

Expected: failure (module not found).

- [ ] **Step 3: Implement the helper**

Create `bordercore/front-end/react/collection/density.ts`:

```ts
export const DENSITY_STOPS = ["compact", "grid", "mosaic", "cinema"] as const;

export type Density = typeof DENSITY_STOPS[number];

export const STORAGE_KEY = "bordercore.collections.density";

const DEFAULT: Density = "grid";

export function densityFromIndex(i: number): Density {
  if (i < 0 || i >= DENSITY_STOPS.length || !Number.isInteger(i)) return DEFAULT;
  return DENSITY_STOPS[i];
}

export function indexFromDensity(d: Density): number {
  return DENSITY_STOPS.indexOf(d);
}

function isDensity(value: unknown): value is Density {
  return typeof value === "string" && (DENSITY_STOPS as readonly string[]).includes(value);
}

export function loadDensity(): Density {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isDensity(raw) ? raw : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function saveDensity(density: Density): void {
  try {
    localStorage.setItem(STORAGE_KEY, density);
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}
```

- [ ] **Step 4: Run the tests — confirm they pass**

```bash
npm --prefix bordercore test -- density.test.ts 2>&1 | tail -15
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add bordercore/front-end/react/collection/density.ts bordercore/front-end/react/collection/density.test.ts
script -qc "git commit -m 'Add density persistence helper with tests'" /dev/null
```

---

## Task 6: SCSS — wholesale rewrite of `_collections.scss`

**Files:**
- Modify: `bordercore/static/scss/pages/_collections.scss` (replace entire contents)

- [ ] **Step 1: Verify only this page uses the old class names**

```bash
grep -rn "collection-container\b\|collection-cover-container\|sortable-collection-grid-item\|collection-list-divider" bordercore --include="*.html" --include="*.tsx" --include="*.scss" | grep -v node_modules | grep -v coverage
```

Expected: matches only inside `_collections.scss`, `CollectionListPage.tsx`, and `CollectionCard.tsx` (all being rewritten/deleted). If any other template references them, stop and ask.

- [ ] **Step 2: Replace the file's contents wholesale**

Overwrite `bordercore/static/scss/pages/_collections.scss` with:

```scss
// =============================================================================
// PAGES: COLLECTIONS LANDING (v2 — density slider)
// =============================================================================
// All styles scoped under .cl-shell. Tokens use the existing --bc-* design
// system already declared at :root in _refined-topbar.scss.
//
// stylelint-disable no-descending-specificity, color-function-notation

@import "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";

// Tag colors (mirrors front-end/react/collection/tagColors.ts).
$tag-colors: (
  cyberpunk: #b36bff,
  fitness: #3fd29c,
  inspiration: #f0b840,
  ui: #4cc2ff,
  reference: #7c7fff,
  food: #ff5577,
  travel: #3fd29c,
  art: #ff3dbd,
  reading: #f0b840,
  cosplay: #ff3dbd,
  retro: #7c7fff,
  workspace: #4cc2ff,
  personal: #b36bff,
  links: #4cc2ff,
  research: #7c7fff,
  default: #7c7fff,
);

@function bc-alpha($color, $alpha) {
  @return rgba(red($color), green($color), blue($color), $alpha);
}

.cl-shell {
  --cl-rail-w: 240px;
  --cl-topbar-h: 56px;

  display: grid;
  min-height: calc(100vh - var(--cl-topbar-h));
  margin: -1rem -1.5rem 0;
  background: var(--bc-bg-1);
  color: var(--bc-fg-1);
  font-family: var(--bc-font-sans);
  font-size: 14px;
  grid-template-columns: var(--cl-rail-w) 1fr;
  letter-spacing: -0.005em;
  line-height: 1.55;
}

// --- Tag rail -----------------------------------------------------------------

.cl-rail {
  display: flex;
  flex-direction: column;
  padding: 20px 14px;
  border-right: 1px solid var(--bc-border-1);
  background: bc-alpha(#0b0d14, 0.4);
  gap: 18px;
}

.cl-rail-label {
  margin: 0 0 6px;
  color: var(--bc-fg-4);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.cl-rail-filter {
  position: relative;
  display: block;

  .cl-rail-filter-icon {
    position: absolute;
    top: 50%;
    left: 8px;
    color: var(--bc-fg-4);
    font-size: 12px;
    pointer-events: none;
    transform: translateY(-50%);
  }

  input {
    width: 100%;
    height: 32px;
    padding: 0 10px 0 26px;
    border: 1px solid var(--bc-border-1);
    border-radius: var(--bc-radius-md);
    background: var(--bc-bg-1);
    color: var(--bc-fg-1);
    font-family: inherit;
    font-size: 12px;

    &::placeholder {
      color: var(--bc-fg-4);
    }

    &:focus {
      border-color: var(--bc-accent);
      box-shadow: 0 0 0 2px bc-alpha(#b36bff, 0.25);
      outline: none;
    }
  }
}

.cl-rail-nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cl-rail-row {
  display: grid;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: var(--bc-radius-md);
  background: transparent;
  color: var(--bc-fg-2);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  gap: 8px;
  grid-template-columns: 7px 1fr auto;
  text-align: left;

  .cl-rail-swatch {
    width: 7px;
    height: 7px;
    border-radius: 2px;
  }

  .cl-rail-count {
    color: var(--bc-fg-4);
    font-family: var(--bc-font-mono);
    font-size: 11px;
  }

  &:hover {
    background: var(--bc-bg-2);
    color: var(--bc-fg-1);
  }

  &.is-active {
    border-color: bc-alpha(#b36bff, 0.28);
    background: bc-alpha(#b36bff, 0.10);
    box-shadow: 0 0 12px -4px bc-alpha(#b36bff, 0.5);
    color: var(--bc-fg-1);

    .cl-rail-count {
      color: var(--bc-accent);
    }
  }
}

.cl-rail-footer {
  margin-top: auto;
  color: var(--bc-fg-4);
  font-family: var(--bc-font-mono);
  font-size: 11px;

  .cl-rail-footer-accent {
    color: var(--bc-accent);
  }
}

// --- Main column --------------------------------------------------------------

.cl-main {
  max-width: 1400px;
  padding: 32px 40px 80px;
}

// --- Page head ----------------------------------------------------------------

.cl-pagehead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--bc-hairline);
  gap: 24px;
}

.cl-pagehead-crumbs {
  margin-bottom: 8px;
  color: var(--bc-fg-4);
  font-family: var(--bc-font-mono);
  font-size: 12px;

  .cl-crumb-link {
    color: var(--bc-accent-2);
    cursor: pointer;
    text-decoration: none;
  }

  .cl-crumb-sep {
    margin: 0 8px;
    color: #3a3e4b;
  }

  .cl-crumb-here {
    color: var(--bc-fg-1);
  }
}

.cl-pagehead-title {
  margin: 0;
  font-family: var(--bc-font-display);
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.015em;

  .cl-fav-star {
    margin-right: 12px;
    color: #f0b840;
    filter: drop-shadow(0 0 8px bc-alpha(#f0b840, 0.5));
    font-size: 0.8em;
    vertical-align: 2px;
  }
}

.cl-pagehead-meta {
  margin-top: 6px;
  color: var(--bc-fg-4);
  font-family: var(--bc-font-mono);
  font-size: 12px;
}

// --- Action cluster -----------------------------------------------------------

.cl-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cl-search {
  position: relative;
  display: flex;
  align-items: center;
  width: 340px;
  height: 36px;
  padding: 0 14px 0 32px;
  border: 1px solid var(--bc-border-1);
  border-radius: var(--bc-radius-pill);
  background: var(--bc-bg-2);

  .cl-search-icon {
    position: absolute;
    top: 50%;
    left: 13px;
    color: var(--bc-fg-3);
    font-size: 13px;
    pointer-events: none;
    transform: translateY(-50%);
  }

  input {
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--bc-fg-1);
    font-family: inherit;
    font-size: 13px;

    &::placeholder {
      color: var(--bc-fg-4);
    }

    &:focus {
      outline: none;
    }
  }

  .cl-search-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: 0;
    border-radius: 999px;
    background: var(--bc-bg-4);
    color: var(--bc-fg-2);
    cursor: pointer;
    font-size: 10px;
  }

  &:focus-within {
    border-color: var(--bc-accent);
    box-shadow: 0 0 0 2px bc-alpha(#b36bff, 0.25);
  }
}

.cl-density {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 6px 10px 6px 12px;
  border: 1px solid var(--bc-border-1);
  border-radius: var(--bc-radius-pill);
  background: var(--bc-bg-2);
  gap: 10px;

  .cl-density-icon {
    color: var(--bc-fg-3);
    font-size: 12px;
  }

  input[type="range"] {
    width: 88px;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;

    &::-webkit-slider-runnable-track {
      height: 4px;
      border-radius: 2px;
      background: var(--bc-bg-4);
    }

    &::-moz-range-track {
      height: 4px;
      border-radius: 2px;
      background: var(--bc-bg-4);
    }

    &::-webkit-slider-thumb {
      width: 14px;
      height: 14px;
      border: 2px solid var(--bc-bg-3);
      border-radius: 50%;
      margin-top: -5px;
      -webkit-appearance: none;
      appearance: none;
      background: var(--bc-accent);
      box-shadow: 0 0 10px bc-alpha(#b36bff, 0.6);
      cursor: pointer;
    }

    &::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border: 2px solid var(--bc-bg-3);
      border-radius: 50%;
      background: var(--bc-accent);
      box-shadow: 0 0 10px bc-alpha(#b36bff, 0.6);
      cursor: pointer;
    }

    &:focus {
      outline: none;
    }
  }

  .cl-density-stop {
    min-width: 56px;
    color: var(--bc-fg-3);
    font-family: var(--bc-font-mono);
    font-size: 11px;
  }

  .cl-density-count {
    color: var(--bc-fg-4);
    font-family: var(--bc-font-mono);
    font-size: 11px;
  }
}

.cl-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--bc-border-1);
  border-radius: var(--bc-radius-md);
  background: var(--bc-bg-2);
  color: var(--bc-fg-2);
  cursor: pointer;
  font-size: 14px;

  &:hover {
    border-color: var(--bc-border-2);
    background: var(--bc-bg-3);
    color: var(--bc-fg-1);
  }

  &.is-primary {
    width: auto;
    padding: 0 14px;
    border-color: transparent;
    background: linear-gradient(180deg, #b36bff, #9355ef);
    box-shadow: 0 0 0 1px bc-alpha(#b36bff, 0.4), 0 0 14px -2px bc-alpha(#b36bff, 0.6);
    color: #fff;
    font-size: 13px;
    font-weight: 600;

    &:hover {
      background: linear-gradient(180deg, #c180ff, #a268ff);
    }
  }
}

// --- Grid wrapper -------------------------------------------------------------

.cl-grid-v2 {
  display: grid;
  gap: 14px;

  &[data-density="compact"] {
    gap: 0;
    grid-template-columns: 1fr;
  }

  &[data-density="grid"] {
    gap: 14px;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }

  &[data-density="mosaic"] {
    gap: 18px;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }

  &[data-density="cinema"] {
    gap: 22px;
    grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  }
}

// --- Compact row --------------------------------------------------------------

.cl-row-compact {
  display: grid;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--bc-hairline);
  color: inherit;
  gap: 16px;
  grid-template-columns: 36px 1fr 80px 110px 80px 28px;
  text-decoration: none;

  &:hover {
    background: var(--bc-bg-2);
  }

  .cl-row-name {
    overflow: hidden;
    color: var(--bc-fg-1);
    font-size: 13.5px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;

    .cl-fav-star {
      margin-right: 8px;
      color: #f0b840;
      font-size: 12px;
    }
  }

  .cl-row-count,
  .cl-row-modified {
    color: var(--bc-fg-3);
    font-family: var(--bc-font-mono);
    font-size: 11.5px;
    text-align: right;
  }

  .cl-row-tags {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .cl-row-chevron {
    color: var(--bc-fg-4);
    font-size: 11px;
    text-align: right;
  }
}

// --- Grid / mosaic card -------------------------------------------------------

.cl-card-grid {
  display: flex;
  overflow: hidden;
  flex-direction: column;
  border: 1px solid var(--bc-border-1);
  border-radius: var(--bc-radius-lg, 14px);
  background: var(--bc-bg-2);
  color: inherit;
  text-decoration: none;
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
              border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1);

  .cl-card-cover {
    aspect-ratio: 16 / 11;
    border-bottom: 1px solid var(--bc-border-1);
  }

  .cl-card-body {
    display: flex;
    flex-direction: column;
    padding: 12px 14px 14px;
    gap: 6px;
  }

  .cl-card-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .cl-card-title {
    overflow: hidden;
    flex: 1;
    color: var(--bc-fg-1);
    font-family: var(--bc-font-display);
    font-size: 15px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cl-card-fav {
    color: #f0b840;
    font-size: 13px;
  }

  .cl-card-meta {
    color: var(--bc-fg-4);
    font-family: var(--bc-font-mono);
    font-size: 11px;

    .cl-meta-sep {
      margin: 0 6px;
      color: #3a3e4b;
    }
  }

  .cl-card-desc {
    display: -webkit-box;
    overflow: hidden;
    margin-top: 4px;
    -webkit-box-orient: vertical;
    color: var(--bc-fg-3);
    font-size: 12px;
    line-height: 1.45;
    -webkit-line-clamp: 2;
  }

  .cl-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &.is-mosaic {
    aspect-ratio: auto;
  }

  &:hover {
    border-color: var(--bc-border-2);
    box-shadow: 0 0 0 1px bc-alpha(#b36bff, 0.18),
                0 12px 28px -8px rgba(0, 0, 0, 0.5),
                0 0 18px -4px bc-alpha(#b36bff, 0.25);
    transform: translateY(-2px);
  }
}

// --- Cinema card --------------------------------------------------------------

.cl-card-cinema {
  position: relative;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  border: 1px solid var(--bc-border-1);
  border-radius: 20px;
  background: var(--bc-bg-2);
  color: inherit;
  text-decoration: none;
  transition: border-color 280ms cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 280ms cubic-bezier(0.22, 1, 0.36, 1);

  .cl-cinema-cover {
    position: relative;
    aspect-ratio: 16 / 9;

    &::after {
      position: absolute;
      background: linear-gradient(180deg, transparent 30%, rgba(7, 7, 12, 0.85));
      content: "";
      inset: 0;
      pointer-events: none;
    }
  }

  .cl-cinema-overlay {
    position: absolute;
    z-index: 1;
    right: 22px;
    bottom: 18px;
    left: 22px;
  }

  .cl-cinema-title {
    margin: 0 0 4px;
    color: #fff;
    font-family: var(--bc-font-display);
    font-size: 22px;
    font-weight: 600;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
  }

  .cl-cinema-desc {
    display: -webkit-box;
    overflow: hidden;
    max-width: 90%;
    -webkit-box-orient: vertical;
    color: rgba(232, 232, 240, 0.85);
    font-size: 13px;
    -webkit-line-clamp: 2;
  }

  .cl-cinema-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 22px;
    border-top: 1px solid var(--bc-hairline);
    background: bc-alpha(#0b0d14, 0.4);
    gap: 12px;

    .cl-cinema-meta {
      color: var(--bc-fg-4);
      font-family: var(--bc-font-mono);
      font-size: 11px;
    }

    .cl-cinema-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  }

  &:hover {
    border-color: bc-alpha(#b36bff, 0.5);
    box-shadow: 0 0 0 1px bc-alpha(#b36bff, 0.25),
                0 24px 48px -16px rgba(0, 0, 0, 0.6),
                0 0 28px -8px bc-alpha(#b36bff, 0.4);
  }
}

// --- Cover mosaic -------------------------------------------------------------

.cl-mosaic {
  display: grid;
  width: 100%;
  height: 100%;
  background: var(--bc-bg-1);
  gap: 2px;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.cl-mosaic-tile {
  overflow: hidden;
  background: var(--bc-bg-1);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.cl-mosaic-tile-empty {
  background: repeating-linear-gradient(
    45deg,
    var(--bc-bg-2) 0 8px,
    var(--bc-bg-3) 8px 16px
  );
}

.cl-mosaic-thumb-sm {
  width: 36px;
  height: 36px;
  border-radius: 6px;
}

// --- Tag chip + dot -----------------------------------------------------------

.cl-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px 2px 7px;
  border: 1px solid;
  border-radius: var(--bc-radius-pill);
  font-size: 11px;
  font-weight: 500;
  gap: 5px;

  .cl-tag-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }
}

.cl-tag-dot-only {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

@each $name, $color in $tag-colors {
  .cl-tag-color-#{$name} {
    border-color: bc-alpha($color, 0.25);
    background: bc-alpha($color, 0.11);
    color: $color;

    .cl-tag-dot {
      background: $color;
      box-shadow: 0 0 5px bc-alpha($color, 0.66);
    }

    &.cl-tag-dot-only {
      background: $color;
      box-shadow: 0 0 5px bc-alpha($color, 0.66);
    }

    &.cl-rail-swatch {
      background: $color;
    }
  }
}

// --- Empty state --------------------------------------------------------------

.cl-empty {
  padding: 40px;
  color: var(--bc-fg-4);
  font-family: var(--bc-font-mono);
  font-size: 13px;
  text-align: center;
}
```

- [ ] **Step 3: Build the SCSS to confirm it compiles**

```bash
npm --prefix bordercore run vite:build 2>&1 | tail -20
```

Expected: build succeeds. (TypeScript may still error from Task 2 — ignore TS errors here; we want SCSS-only validation.) If the SCSS-side errors, fix them before continuing.

- [ ] **Step 4: Commit**

```bash
git add bordercore/static/scss/pages/_collections.scss
script -qc "git commit -m 'Rewrite collections page SCSS for v2 density slider design'" /dev/null
```

---

## Task 7: Frontend — TagChip and CoverMosaic components

**Files:**
- Create: `bordercore/front-end/react/collection/TagChip.tsx`
- Create: `bordercore/front-end/react/collection/CoverMosaic.tsx`

- [ ] **Step 1: Create `TagChip.tsx`**

```tsx
import React from "react";
import { tagSlug } from "./tagColors";

interface TagChipProps {
  name: string;
}

export function TagChip({ name }: TagChipProps) {
  return (
    <span className={`cl-tag cl-tag-color-${tagSlug(name)}`}>
      <span className="cl-tag-dot" />
      <span>{name}</span>
    </span>
  );
}

interface TagDotProps {
  name: string;
}

export function TagDot({ name }: TagDotProps) {
  return <span className={`cl-tag-dot-only cl-tag-color-${tagSlug(name)}`} aria-hidden="true" />;
}

export default TagChip;
```

- [ ] **Step 2: Create `CoverMosaic.tsx`**

```tsx
import React from "react";

interface CoverMosaicProps {
  tiles: (string | null)[];
  alt: string;
  small?: boolean;
}

export function CoverMosaic({ tiles, alt, small = false }: CoverMosaicProps) {
  return (
    <div className={`cl-mosaic${small ? " cl-mosaic-thumb-sm" : ""}`}>
      {tiles.slice(0, 4).map((url, i) => (
        <div
          key={i}
          className={`cl-mosaic-tile${url ? "" : " cl-mosaic-tile-empty"}`}
        >
          {url ? <img src={url} alt={i === 0 ? alt : ""} loading="lazy" /> : null}
        </div>
      ))}
    </div>
  );
}

export default CoverMosaic;
```

- [ ] **Step 3: Type-check the new files**

```bash
npm --prefix bordercore run typecheck 2>&1 | grep -E "TagChip|CoverMosaic" || echo "no errors in new files"
```

Expected: no errors in `TagChip.tsx` or `CoverMosaic.tsx`. (Other files still error from Task 2 — that's fine.)

- [ ] **Step 4: Commit**

```bash
git add bordercore/front-end/react/collection/TagChip.tsx bordercore/front-end/react/collection/CoverMosaic.tsx
script -qc "git commit -m 'Add TagChip and CoverMosaic components for v2 landing'" /dev/null
```

---

## Task 8: Frontend — DensitySlider component

**Files:**
- Create: `bordercore/front-end/react/collection/DensitySlider.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React from "react";
import { DENSITY_STOPS, densityFromIndex, indexFromDensity, type Density } from "./density";

interface DensitySliderProps {
  density: Density;
  count: number;
  onChange: (next: Density) => void;
}

export function DensitySlider({ density, count, onChange }: DensitySliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(densityFromIndex(Number(e.target.value)));
  };

  return (
    <div className="cl-density">
      <span className="cl-density-icon" aria-hidden="true">⊟</span>
      <input
        type="range"
        min={0}
        max={DENSITY_STOPS.length - 1}
        step={1}
        value={indexFromDensity(density)}
        onChange={handleChange}
        aria-label="display density"
        aria-valuetext={density}
      />
      <span className="cl-density-stop">{density}</span>
      <span className="cl-density-count">· {count}</span>
    </div>
  );
}

export default DensitySlider;
```

- [ ] **Step 2: Type-check**

```bash
npm --prefix bordercore run typecheck 2>&1 | grep -E "DensitySlider\.tsx" || echo "no errors"
```

Expected: no errors in `DensitySlider.tsx`.

- [ ] **Step 3: Commit**

```bash
git add bordercore/front-end/react/collection/DensitySlider.tsx
script -qc "git commit -m 'Add DensitySlider component'" /dev/null
```

---

## Task 9: Frontend — TagRail component

**Files:**
- Create: `bordercore/front-end/react/collection/TagRail.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React, { useMemo, useState } from "react";
import { tagSlug } from "./tagColors";
import type { TagCounts } from "./types";

interface TagRailProps {
  totalCount: number;
  tagCounts: TagCounts;
  activeTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

export function TagRail({ totalCount, tagCounts, activeTag, onTagSelect }: TagRailProps) {
  const [filter, setFilter] = useState("");

  const sortedTags = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return Object.entries(tagCounts)
      .filter(([name]) => !q || name.toLowerCase().includes(q))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [tagCounts, filter]);

  const handleTagClick = (tag: string) => {
    onTagSelect(activeTag === tag ? null : tag);
  };

  return (
    <aside className="cl-rail" aria-label="Tag filter">
      <h2 className="cl-rail-label">tags</h2>

      <label className="cl-rail-filter">
        <span className="cl-rail-filter-icon" aria-hidden="true">⌕</span>
        <input
          type="text"
          placeholder="filter tags"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </label>

      <nav className="cl-rail-nav">
        <button
          type="button"
          className={`cl-rail-row${activeTag === null ? " is-active" : ""}`}
          onClick={() => onTagSelect(null)}
        >
          <span className="cl-rail-swatch cl-tag-color-default" />
          <span>all collections</span>
          <span className="cl-rail-count">{totalCount}</span>
        </button>

        {sortedTags.map(([name, count]) => (
          <button
            key={name}
            type="button"
            className={`cl-rail-row${activeTag === name ? " is-active" : ""}`}
            onClick={() => handleTagClick(name)}
          >
            <span className={`cl-rail-swatch cl-tag-color-${tagSlug(name)}`} />
            <span>{name}</span>
            <span className="cl-rail-count">{count}</span>
          </button>
        ))}
      </nav>

      <div className="cl-rail-footer">
        <div>last sync <span className="cl-rail-footer-accent">just now</span></div>
        <div>{totalCount} total · favorites only</div>
      </div>
    </aside>
  );
}

export default TagRail;
```

- [ ] **Step 2: Type-check**

```bash
npm --prefix bordercore run typecheck 2>&1 | grep -E "TagRail\.tsx" || echo "no errors"
```

Expected: no errors in `TagRail.tsx`.

- [ ] **Step 3: Commit**

```bash
git add bordercore/front-end/react/collection/TagRail.tsx
script -qc "git commit -m 'Add TagRail component'" /dev/null
```

---

## Task 10: Frontend — ActionCluster component

**Files:**
- Create: `bordercore/front-end/react/collection/ActionCluster.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React from "react";
import DensitySlider from "./DensitySlider";
import type { Density } from "./density";

interface ActionClusterProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  density: Density;
  filteredCount: number;
  onDensityChange: (d: Density) => void;
  onCreateClick: () => void;
}

export function ActionCluster({
  searchQuery,
  onSearchChange,
  density,
  filteredCount,
  onDensityChange,
  onCreateClick,
}: ActionClusterProps) {
  return (
    <div className="cl-actions">
      <div className="cl-search">
        <span className="cl-search-icon" aria-hidden="true">⌕</span>
        <input
          type="text"
          placeholder="search collections"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          aria-label="Search collections"
        />
        {searchQuery && (
          <button
            type="button"
            className="cl-search-clear"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <DensitySlider density={density} count={filteredCount} onChange={onDensityChange} />

      <button type="button" className="cl-iconbtn" aria-label="Shuffle order">⤨</button>
      <button type="button" className="cl-iconbtn" aria-label="Edit">✎</button>
      <button
        type="button"
        className="cl-iconbtn is-primary"
        onClick={onCreateClick}
      >
        + new
      </button>
      <button type="button" className="cl-iconbtn" aria-label="More">⋯</button>
    </div>
  );
}

export default ActionCluster;
```

- [ ] **Step 2: Type-check**

```bash
npm --prefix bordercore run typecheck 2>&1 | grep -E "ActionCluster\.tsx" || echo "no errors"
```

Expected: no errors in `ActionCluster.tsx`.

- [ ] **Step 3: Commit**

```bash
git add bordercore/front-end/react/collection/ActionCluster.tsx
script -qc "git commit -m 'Add ActionCluster component'" /dev/null
```

---

## Task 11: Frontend — Card variants and main page rewrite

This is the largest task. We rewrite the page entry point, swap in the new types, delete the obsolete component, and create the three card variants. Done as one task because together they bring the codebase back to a typecheck-clean state — splitting them leaves master broken.

**Files:**
- Create: `bordercore/front-end/react/collection/CompactRow.tsx`
- Create: `bordercore/front-end/react/collection/GridCard.tsx`
- Create: `bordercore/front-end/react/collection/CinemaCard.tsx`
- Modify: `bordercore/front-end/react/collection/CollectionListPage.tsx` (full rewrite)
- Modify: `bordercore/front-end/entries/collection-list.tsx` (read new shape)
- Modify: `bordercore/templates/collection/collection_list.html` (add tag_counts json_script)
- Delete: `bordercore/front-end/react/collection/CollectionCard.tsx`

- [ ] **Step 1: Create `CompactRow.tsx`**

```tsx
import React from "react";
import CoverMosaic from "./CoverMosaic";
import { TagDot } from "./TagChip";
import type { Collection } from "./types";

interface CompactRowProps {
  collection: Collection;
}

export function CompactRow({ collection }: CompactRowProps) {
  return (
    <a href={collection.url} className="cl-row-compact">
      <CoverMosaic tiles={collection.cover_tiles} alt={collection.name} small />
      <span className="cl-row-name">
        {collection.is_favorite && <span className="cl-fav-star" aria-hidden="true">★</span>}
        {collection.name}
      </span>
      <span className="cl-row-count">{collection.num_objects} obj</span>
      <span className="cl-row-modified">{collection.modified}</span>
      <span className="cl-row-tags">
        {collection.tags.slice(0, 3).map(t => <TagDot key={t} name={t} />)}
      </span>
      <span className="cl-row-chevron" aria-hidden="true">▸</span>
    </a>
  );
}

export default CompactRow;
```

- [ ] **Step 2: Create `GridCard.tsx`**

```tsx
import React from "react";
import CoverMosaic from "./CoverMosaic";
import TagChip from "./TagChip";
import type { Collection } from "./types";

interface GridCardProps {
  collection: Collection;
  mosaic?: boolean;
}

export function GridCard({ collection, mosaic = false }: GridCardProps) {
  return (
    <a href={collection.url} className={`cl-card-grid${mosaic ? " is-mosaic" : ""}`}>
      <div className="cl-card-cover">
        <CoverMosaic tiles={collection.cover_tiles} alt={collection.name} />
      </div>
      <div className="cl-card-body">
        <div className="cl-card-title-row">
          <span className="cl-card-title">{collection.name}</span>
          {collection.is_favorite && <span className="cl-card-fav" aria-hidden="true">★</span>}
        </div>
        <div className="cl-card-meta">
          <span>{collection.num_objects} objects</span>
          <span className="cl-meta-sep">·</span>
          <span>{collection.modified}</span>
        </div>
        {mosaic && collection.description && (
          <p className="cl-card-desc">{collection.description}</p>
        )}
        <div className="cl-card-tags">
          {collection.tags.slice(0, 3).map(t => <TagChip key={t} name={t} />)}
        </div>
      </div>
    </a>
  );
}

export default GridCard;
```

- [ ] **Step 3: Create `CinemaCard.tsx`**

```tsx
import React from "react";
import CoverMosaic from "./CoverMosaic";
import TagChip from "./TagChip";
import type { Collection } from "./types";

interface CinemaCardProps {
  collection: Collection;
}

export function CinemaCard({ collection }: CinemaCardProps) {
  return (
    <a href={collection.url} className="cl-card-cinema">
      <div className="cl-cinema-cover">
        <CoverMosaic tiles={collection.cover_tiles} alt={collection.name} />
      </div>
      <div className="cl-cinema-overlay">
        <h3 className="cl-cinema-title">{collection.name}</h3>
        {collection.description && (
          <p className="cl-cinema-desc">{collection.description}</p>
        )}
      </div>
      <div className="cl-cinema-foot">
        <div className="cl-cinema-meta">
          {collection.num_objects} objects · {collection.modified}
        </div>
        <div className="cl-cinema-tags">
          {collection.tags.slice(0, 3).map(t => <TagChip key={t} name={t} />)}
        </div>
      </div>
    </a>
  );
}

export default CinemaCard;
```

- [ ] **Step 4: Replace `CollectionListPage.tsx` wholesale**

Overwrite `bordercore/front-end/react/collection/CollectionListPage.tsx` with:

```tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ActionCluster from "./ActionCluster";
import CinemaCard from "./CinemaCard";
import CompactRow from "./CompactRow";
import CreateCollectionModal, { CreateCollectionModalHandle } from "./CreateCollectionModal";
import GridCard from "./GridCard";
import TagRail from "./TagRail";
import { filterCollections } from "./filter";
import { loadDensity, saveDensity, type Density } from "./density";
import type { Collection, CollectionListUrls, TagCounts } from "./types";

interface CollectionListPageProps {
  collections: Collection[];
  tagCounts: TagCounts;
  urls: CollectionListUrls;
}

export function CollectionListPage({ collections, tagCounts, urls }: CollectionListPageProps) {
  const [density, setDensity] = useState<Density>(() => loadDensity());
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const createModalRef = useRef<CreateCollectionModalHandle>(null);

  useEffect(() => {
    saveDensity(density);
  }, [density]);

  const filtered = useMemo(
    () => filterCollections(collections, searchQuery, activeTag),
    [collections, searchQuery, activeTag],
  );

  const handleCreate = () => createModalRef.current?.openModal();

  return (
    <>
      <div className="cl-shell">
        <TagRail
          totalCount={collections.length}
          tagCounts={tagCounts}
          activeTag={activeTag}
          onTagSelect={setActiveTag}
        />

        <main className="cl-main">
          <header className="cl-pagehead">
            <div>
              <div className="cl-pagehead-crumbs">
                <span className="cl-crumb-link">knowledge</span>
                <span className="cl-crumb-sep">/</span>
                <span className="cl-crumb-here">collections</span>
              </div>
              <h1 className="cl-pagehead-title">
                <span className="cl-fav-star" aria-hidden="true">★</span>
                Favorites
              </h1>
              <div className="cl-pagehead-meta">
                {filtered.length} collections · density · {density}
              </div>
            </div>

            <ActionCluster
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              density={density}
              filteredCount={filtered.length}
              onDensityChange={setDensity}
              onCreateClick={handleCreate}
            />
          </header>

          {filtered.length === 0 ? (
            <div className="cl-empty">No collections match the current filters.</div>
          ) : (
            <div className="cl-grid-v2" data-density={density}>
              {filtered.map(c => {
                if (density === "compact") return <CompactRow key={c.uuid} collection={c} />;
                if (density === "cinema") return <CinemaCard key={c.uuid} collection={c} />;
                return <GridCard key={c.uuid} collection={c} mosaic={density === "mosaic"} />;
              })}
            </div>
          )}
        </main>
      </div>

      <CreateCollectionModal
        ref={createModalRef}
        createUrl={urls.createCollection}
        tagSearchUrl={urls.tagSearch}
      />
    </>
  );
}

export default CollectionListPage;
```

- [ ] **Step 5: Update the entry file**

Overwrite `bordercore/front-end/entries/collection-list.tsx` with:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import CollectionListPage from "../react/collection/CollectionListPage";
import type { Collection, CollectionListUrls, TagCounts } from "../react/collection/types";

const container = document.getElementById("react-root");

if (container) {
  const collectionDataEl = document.getElementById("collection-list-data");
  const collections: Collection[] = collectionDataEl
    ? JSON.parse(collectionDataEl.textContent || "[]")
    : [];

  const tagCountsEl = document.getElementById("tag-counts-data");
  const tagCounts: TagCounts = tagCountsEl
    ? JSON.parse(tagCountsEl.textContent || "{}")
    : {};

  const urls: CollectionListUrls = {
    createCollection: container.dataset.createCollectionUrl || "",
    tagSearch: container.dataset.tagSearchUrl || "",
  };

  const root = createRoot(container);
  root.render(
    <CollectionListPage
      collections={collections}
      tagCounts={tagCounts}
      urls={urls}
    />,
  );
}
```

- [ ] **Step 6: Update the template**

Edit `bordercore/templates/collection/collection_list.html` — add the tag_counts json_script line after the existing collection_list one. Final content of the `javascript_bundles` block:

```html
{% block javascript_bundles %}
    {{ block.super }}
    {{ collection_list|json_script:"collection-list-data" }}
    {{ tag_counts|json_script:"tag-counts-data" }}
    {% vite_asset "dist/js/collection-list" %}
{% endblock %}
```

Leave the `{% block content %}`, `{% block help %}`, and template extends untouched.

- [ ] **Step 7: Delete `CollectionCard.tsx`**

```bash
git rm bordercore/front-end/react/collection/CollectionCard.tsx
```

- [ ] **Step 8: Type-check the whole project**

```bash
npm --prefix bordercore run typecheck
```

Expected: no errors. (If errors remain in unrelated files, that's pre-existing — but anything inside `front-end/react/collection/` or `front-end/entries/collection-list.tsx` must be clean.)

- [ ] **Step 9: Run vitest — confirm everything still passes**

```bash
npm --prefix bordercore test
```

Expected: filter and density tests pass, no other regressions.

- [ ] **Step 10: Run the HTML/inline-style quality test**

```bash
BORDERCORE_HOME="$(pwd)/bordercore" .venv/bin/python3 -m pytest bordercore/tests/test_general.py::test_html -v
```

Expected: PASS. If it fails, the violation list will name the file + line — fix that line to remove the inline style and re-run.

- [ ] **Step 11: Run the collection backend tests**

```bash
.venv/bin/python3 -m pytest bordercore/collection/tests/test_views.py -v
```

Expected: all pass.

- [ ] **Step 12: Build vite to confirm everything compiles**

```bash
npm --prefix bordercore run vite:build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 13: Commit**

```bash
git add bordercore/front-end/react/collection/types.ts \
        bordercore/front-end/react/collection/CompactRow.tsx \
        bordercore/front-end/react/collection/GridCard.tsx \
        bordercore/front-end/react/collection/CinemaCard.tsx \
        bordercore/front-end/react/collection/CollectionListPage.tsx \
        bordercore/front-end/entries/collection-list.tsx \
        bordercore/templates/collection/collection_list.html
git rm --cached bordercore/front-end/react/collection/CollectionCard.tsx 2>/dev/null || true
script -qc "git commit -m 'Wire v2 collections landing page

- Add CompactRow / GridCard / CinemaCard variants.
- Rewrite CollectionListPage as the density-slider shell.
- Replace Collection type with the v2 shape; add TagCounts.
- Update entry to read tag_counts; expose tag_counts in template.
- Remove obsolete CollectionCard component.'" /dev/null
```

---

## Task 12: Final verification

**Files:** none modified.

- [ ] **Step 1: Run vitest in full**

```bash
npm --prefix bordercore test
```

Expected: all `filter` and `density` tests pass; no regressions elsewhere.

- [ ] **Step 2: Run the relevant Python test slice**

```bash
.venv/bin/python3 -m pytest bordercore/collection/tests/test_views.py bordercore/tests/test_general.py::test_html -v
```

Expected: all pass.

- [ ] **Step 3: Type-check**

```bash
npm --prefix bordercore run typecheck
```

Expected: no errors in any of the files we touched.

- [ ] **Step 4: Build vite**

```bash
npm --prefix bordercore run vite:build
```

Expected: clean build.

- [ ] **Step 5: Manual visual check**

Start the dev server (`make runserver` or whatever the local convention is) and load `/collection/`. Verify:
- The page renders without console errors.
- Sliding the density control swaps between compact rows, grid cards, mosaic cards (with description), and cinema cards.
- Reload — density persists.
- Search filters by name and description (case-insensitive).
- Clicking a tag in the rail filters the grid; clicking it again clears the filter.
- Search × tag compose (AND).
- `+ new` opens the existing CreateCollectionModal.
- Hover states on cards/rows show the purple glow + translateY.

If any check fails, file follow-up tasks before declaring done. There's no commit at the end of this task — verification is the deliverable.

---

## Self-review

- [x] **Spec coverage.** Backend (Task 1), types (Task 2 + folded into 11), tag colors (Task 3), filter logic (Task 4), density persistence (Task 5), SCSS (Task 6), TagChip + CoverMosaic (Task 7), DensitySlider (Task 8), TagRail (Task 9), ActionCluster (Task 10), card variants + page + entry + template + delete CollectionCard (Task 11), verification (Task 12). Risks and acceptance criteria from the spec are exercised by Task 12's manual check.
- [x] **Placeholder scan.** Every code step has full code. Every test step shows the assertions. Every command shows what to run and the expected result.
- [x] **Type consistency.** `Density` exported from `density.ts` is consumed identically in `DensitySlider`, `ActionCluster`, and `CollectionListPage`. `Collection` shape from `types.ts` matches what `views.py` emits (`num_objects`, `cover_tiles: (string|null)[]`, etc.). `tagSlug` and `TAG_COLORS` are referenced consistently. `loadDensity` / `saveDensity` / `STORAGE_KEY` names match between `density.ts` and `density.test.ts`.
- [x] **Spec deviation note:** the spec described tests under `__tests__/` — the plan colocates them next to source instead, matching the existing repo convention (verified in `front-end/boldenOption.test.ts`, `front-end/react/todo/NewTodoModal.test.tsx`).
