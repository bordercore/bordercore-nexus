# Blob Constellation — Design Spec

**Date:** 2026-04-23
**Status:** Approved for implementation
**Working name:** Constellation (route: `/visualize/`)

## 1 · Summary

A new top-level page that renders a user's entire knowledge base as a
Stellar Drift constellation: every blob plus the bookmarks and questions
that are linked to any blob, laid out by a force-directed simulation on a
starfield background. Primary value is orientation and discovery — "what
does my knowledge base look like, where are the dense areas, what did I
forget I had."

The page is for feel, not analysis. Interaction is deliberately minimal:
pan, zoom, hover for an item card, click to open its detail page.

## 2 · Scope

Small-scale (under ~500 nodes) — no clustering, sampling, or WebGL path.
A guardrail caps rendering at 1500 most-recently-modified items with a
banner if the count grows beyond that in future.

### In scope (v1)

- Full-viewport page at `/visualize/`, behind standard auth.
- Server endpoint returning one JSON payload with all nodes + edges.
- Default edge layers: direct `BlobToObject` links **plus** shared-tag
  edges (top-K=4 per node).
- Layer toggle: shared-collection edges (off by default).
- Pan, zoom (mouse + trackpad), click-to-open, hover tooltip with
  name/thumbnail/type, neighbor highlighting on hover.
- Loading / empty / error states.
- Ambient drift (very slow continuous simulation) — with a kill switch
  if it feels gimmicky.
- Nav link added to the main sidebar.

### Out of scope (v1)

Documented here so they aren't re-debated mid-implementation:

- Search / focus-on-node.
- Draggable or pinned nodes; no persisted positions.
- "Tags as first-class hub nodes" alternative rendering.
- Temporal filter (e.g. "last 30 days").
- Auto-labeled clusters.
- PNG / SVG export.
- Real-time updates (WebSocket / polling).
- Tuned mobile / touch UX — pan & zoom will likely work through
  `d3-zoom`'s built-in touch handling, but is not a supported surface.
- Any rendering path beyond 1500 nodes (clustering, WebGL, progressive
  loading).

## 3 · Data layer

### Endpoint

`GET /visualize/api/graph/?layers=direct,tags[,collections]`

The API lives inside the `visualize/` app's urlconf alongside the page
view. This keeps the new app self-contained — no cross-app coupling to
a shared `api/` urlconf for a feature-specific endpoint.

- Behind standard auth middleware. Scoped to `request.user`.
- Query param `layers` is a comma-separated set. `direct` is always
  implicit; `tags` is the default; `collections` is opt-in.
- Response shape:

```json
{
  "nodes": [
    { "uuid": "...", "type": "blob", "name": "...",
      "thumbnail_url": "...", "detail_url": "...",
      "degree": 7, "importance": 2 },
    { "uuid": "...", "type": "bookmark", "name": "...",
      "detail_url": "...", "degree": 2 },
    { "uuid": "...", "type": "question", "name": "...",
      "detail_url": "...", "degree": 1 }
  ],
  "edges": [
    { "source": "uuid-a", "target": "uuid-b", "kind": "direct",
      "weight": 1 },
    { "source": "uuid-a", "target": "uuid-c", "kind": "tag",
      "weight": 3 }
  ]
}
```

### What's a node

- All of the user's blobs.
- Every bookmark and question referenced by at least one
  `BlobToObject` row owned by the user. Orphan bookmarks and questions
  (never linked to a blob) are excluded — they have nothing to draw.

### What's an edge

- **`direct`** — one edge per `BlobToObject` row. Undirected for
  rendering even though the underlying row is directional (`node` →
  `blob`/`bookmark`/`question`). Weight = 1.
- **`tag`** — per-node top-K=4 most tag-similar neighbors. Weight =
  number of shared tags.
- **`collection`** — same top-K=4 logic on shared-collection membership
  (only emitted when `collections` is in `layers`). Weight = number of
  shared collections.
- **Dedup rule:** if a pair already has a `direct` edge, any `tag` or
  `collection` edge for that same pair is suppressed — the stronger
  semantic wins.

### Edge computation

Direct edges: straight SQL via `BlobToObject.objects.filter(node__user=…)`.

Tag / collection edges (server-side, per request):

1. For each tag (or collection), walk its member objects and increment
   a shared-tag counter for every pair. Sparse dict keyed by
   `frozenset({uuid_a, uuid_b})`.
2. For each node, sort its partners by shared-count desc and keep the
   top 4. Emit one edge per kept pair.
3. Complexity: `O(Σ nₜ²)` across all tags, which stays well under N² at
   realistic tag sizes. At N≈500 this is sub-100ms work.

Implementation lives in `visualize/services.py` as a pure function
`build_graph(user, layers) → dict` so it's independently testable.

### Caching

- `django.core.cache` with key
  `viz:graph:{user_id}:{sorted_layers_slug}`, TTL 60 seconds.
- Not `@cache_page` — the cache key is scoped to user, not URL.
- Invalidation is TTL-based. Explicit invalidation on object save can be
  added later if staleness feels annoying.

## 4 · Visual design

Direction: **Stellar Drift** — classic force-directed layout on a deep
space background. No cluster outlines, no labels rendered by default;
names appear only in the hover tooltip.

### Background

- Radial gradient: center `#0f1530` (muted indigo) → edges near-black.
- ~150 static white star specks (0.5 px, low opacity). Deterministic,
  generated once from a seeded RNG in `Starfield.tsx`.
- Background does not pan or zoom with the node layer — stays fixed.
  (Simpler; no perceptible loss of parallax at this scale.)

### Nodes

- Type → color: blob `#cfe0ff`, bookmark `#ffd58a`, question `#a6e8c9`.
- Size: `2.5 + sqrt(degree) * 1.2` — lonely node ≈ 2.5 px, hub with 20
  connections ≈ 8 px. Square-root keeps hubs from dominating.
- Soft outer glow via SVG filter (`feGaussianBlur` + `feMerge`),
  applied once and referenced by id.
- Hovered node: radius × 1.3, glow intensified.
- Every node is an `<a>` so Cmd/Ctrl-click opens in a new tab natively.

### Edges

- `stroke-width: 0.6`, base color `#6b7aa8`, base opacity 0.35.
- `direct` kind → opacity 0.55 and a slight blue tint — subtly
  emphasized over `tag`.
- On hover of a node: its edges jump to opacity 0.9 and pick up the
  node's color; non-neighbor edges dim to 0.1.

### Force simulation

`d3-force` with:

- `forceManyBody(-120)` — repulsion.
- `forceLink(distance 35)` — direct links get a higher strength so they
  sit tighter.
- `forceCenter` to pull toward viewport center.
- A weak `forceCollide` to prevent overlap.

Run 300 synchronous ticks at mount, then `alphaTarget(0)` to freeze.
Rendering begins only after the final layout — no visible settling
animation.

**Ambient drift:** optional `alphaTarget(0.003)` kept alive post-freeze
for a barely-perceptible sway. Behind a single flag. If it feels
gimmicky, the flag goes to `false` and the layout stays static.

### Control panel

Top-right glass-morph card, ~250 px wide:

- Title: "Constellation"
- Counts: "{N} items · {E} connections"
- Toggles:
  - Direct links — on, locked
  - Shared tags — on, toggleable
  - Shared collections — off, toggleable
- Toggling triggers a refetch (new `layers` param), then a re-run of
  the force simulation on the updated graph.

### Hover tooltip

Glass-morph card near cursor, after 100 ms hover delay (avoids flicker
when sweeping past nodes):

- Type icon + type label
- Item name, truncated
- Thumbnail (blob only)
- Tag chips (if any)

Disappears immediately on mouseleave.

## 5 · Interaction

- **Pan & zoom:** `d3-zoom` attached to the root SVG. 0.5× to 4×. Wheel
  zooms around the cursor; click-drag pans.
- **Click:** opens item detail page in the same tab. Cmd/Ctrl-click →
  new tab (native anchor behavior).
- **Hover:** see tooltip + neighbor-highlight behavior above.
- **Keyboard:**
  - `Esc` — clear current hover/highlight.
  - `0` — reset zoom & pan to fit-all.
- **No search hotkey** in v1.

### States

- **Loading:** starfield background + centered breathing-opacity
  "Assembling constellation…" text. No skeleton nodes.
- **Empty** (no blobs, or no blobs with any connections yet): centered
  card, "Your constellation is empty…" with a button to the create-blob
  page.
- **Error:** centered retry card. No partial graph.

### Performance guardrail

If the server returns `nodes.length > 1500`, render the 1500
most-recently-modified and show a banner. A fuse, not a feature.

## 6 · Tech stack & implementation sketch

### New dependencies

- `d3-force` (~40 KB)
- `d3-zoom` (~20 KB)

No other new deps. SVG rendered via React — no canvas, no
third-party graph library.

### Django

New app `visualize/`, keeping this feature's views and logic isolated
rather than leaking into `blob/`:

```
bordercore/
  visualize/
    __init__.py
    apps.py
    urls.py
    views.py         # ConstellationPageView, graph_api_view
    services.py      # build_graph(user, layers) — pure, testable
    tests/
      __init__.py
      test_services.py  # fixture-driven edge-computation tests
      test_views.py     # endpoint smoke tests
  templates/visualize/
    constellation.html  # page scaffold + React mount point
```

- Register the app in `INSTALLED_APPS`.
- Add `path("visualize/", include("visualize.urls"))` to the root urlconf.
- No DB migrations needed — all data comes from existing models.

### Frontend

```
front-end/
  entries/visualize.tsx              # new Vite entry
  react/visualize/
    ConstellationPage.tsx            # top-level; owns fetch + zoom state
    ForceGraph.tsx                   # SVG renderer; runs d3-force
    NodeTooltip.tsx                  # hover card
    ControlPanel.tsx                 # layer toggles + counts
    Starfield.tsx                    # deterministic background stars
    useConstellationData.ts          # fetch + refetch-on-layer-change hook
    types.ts                         # NodeData, EdgeData, LayerSet
    tests/
      ConstellationPage.test.tsx
      ControlPanel.test.tsx
      useConstellationData.test.ts
```

- Register the new entry in `vite.config.js` alongside existing entries.
- Follow the existing pattern for reading bootstrap data from
  `<div id="react-root" data-…>` attributes (see other pages).

### Testing strategy

- **Backend:** unit tests on `build_graph()` using fixtures to verify
  direct-edge extraction, top-K tag edges, dedup rule, and layer
  filtering. Endpoint smoke tests for auth and the basic shape of the
  response.
- **Frontend:** vitest for the data hook and `ControlPanel` rendering.
  The force-simulation and SVG output are not snapshot-tested — the
  visual is validated manually.
- **Manual smoke test:** load the page with a real account; confirm
  pan/zoom, click-through, hover tooltip, and layer toggle behavior.

### Rollout

No feature flag. The route is new and unlinked until the nav entry
ships — the worst case is you don't add the link.

## 7 · Open questions

None blocking. Possible follow-ups:

- Does ambient drift survive user testing, or does it get disabled
  immediately? Ship with flag, revisit after living with it.
- Do we want explicit cache invalidation on object save, or is the
  60-second TTL enough? Revisit if staleness becomes a complaint.

---

*This spec was produced via superpowers brainstorming. Proceed with the
writing-plans skill to generate the step-by-step implementation plan.*
