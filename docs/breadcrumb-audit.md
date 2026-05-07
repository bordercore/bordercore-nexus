# Breadcrumb Audit

A site-wide inventory of navigational breadcrumbs in Bordercore, with the goal of consolidating to **one consistent pattern** (markup, visuals, and labels) across the entire site.

**Audit date:** 2026-05-07
**Scope:** 78 pages across 18 sections

---

## TL;DR

- **5 distinct breadcrumb patterns** are in use today.
- **31% of pages** have a breadcrumb; **69% have none**.
- **13 different root-link labels** are in active use, with collisions inside the same section (e.g. Collection uses both `knowledge` and `collections`; Music uses 3 different roots).
- The **refined h1 pattern** (`<h1 class="refined-breadcrumb-h1">`) is the strongest unification target — newest, most-adopted, no Bootstrap coupling.

---

## The 5 patterns in use

| # | Pattern | Where it lives | Markup | Styling |
|---|---|---|---|---|
| 1 | **Bootstrap classic** | Music detail pages, Drill question edit | `<ul class="breadcrumb">` + `breadcrumb-item` | Bootstrap defaults |
| 2 | **Music Library OS (MLO)** | Music list/edit/search React pages | `<div class="mlo-breadcrumb">` with path text | Custom `.mlo-breadcrumb*` |
| 3 | **Refined h1** ⭐ | Todos, Bookmarks, Habits, Notes, Blobs, Album Create | `<h1 class="refined-breadcrumb-h1">` with `.dim` / `.sep` / `.current` spans | `_refined-components.scss` |
| 4 | **Section-specific custom** | Node, Fitness, Collection (Django + React variants), Notes landing | `<nav>` or `<div>` with section-prefixed classes (`.nd-crumb`, `.ex-breadcrumb`, `.cd-crumbs`, `.cl-crumb*`, `.nl-breadcrumb`) | Page-specific SCSS files |
| 5 | **None** | 54 pages | — | — |

---

## Coverage matrix

### Knowledge & content

#### Blob
| Page | Route | File | BC? | Pattern | Label | Root |
|---|---|---|---|---|---|---|
| List | `/blob/list` | `templates/blob/blob_list.html` | No | — | — | — |
| Detail | `/blob/<uuid>/` | `templates/blob/blob_detail.html` | No | — | — | — |
| Create | `/blob/create/` | `templates/blob/update.html` | No | — | — | — |
| Edit | `/blob/<uuid>/update/` | `react/blob/BlobUpdatePage.tsx:426-435` | Yes | refined h1 | `blobs / <uuid> / edit` | blobs |
| Notes landing | `/blob/notes/` | `react/note/landing/NotesLandingPage.tsx:33-41` | Yes | section-specific (`.nl-breadcrumb`) | `blob / notes` | /blob/list |
| Bookshelf | `/blob/bookshelf` | `templates/blob/bookshelf.html` | No | — | — | — |
| Import | `/blob/import` | `templates/blob/import.html` | No | — | — | — |
| PDF viewer | `/blob/<uuid>/pdf-viewer/` | `templates/blob/pdf_viewer.html` | No | — | — | — |

#### Bookmark
| Page | Route | File | BC? | Pattern | Label | Root |
|---|---|---|---|---|---|---|
| List | `/bookmark/` | `templates/bookmark/index.html` | No | — | — | — |
| Create | `/bookmark/create/` | `templates/bookmark/edit.html` | No | — | — | — |
| Edit | `/bookmark/update/<uuid>/` | `react/bookmark/BookmarkEditPage.tsx:159-176` | Yes | refined h1 | `bookmarks / edit / <title>` | bookmarks |

#### Collection
| Page | Route | File | BC? | Pattern | Label | Root |
|---|---|---|---|---|---|---|
| List | `/collection/` | `react/collection/CollectionListPage.tsx:48-51` | Yes | section-specific (`.cl-crumb*`) | `knowledge / collections` | knowledge |
| Detail | `/collection/<uuid>/` | `templates/collection/collection_detail.html:7-11` | Yes | section-specific (`.cd-crumbs`) | `collections / <name>` | collections |
| Create / Update / Delete | various | `collection_list.html` | No | — | — | — |

#### Node
| Page | Route | File | BC? | Pattern | Label | Root |
|---|---|---|---|---|---|---|
| List | `/node/` | `templates/node/node_list.html` | No | — | — | — |
| Detail | `/node/<uuid>/` | `react/node/NodeDetailPage.tsx:829-835` | Yes | section-specific (`.nd-crumb`) | `[icon] nodes / <name>` | icon + "nodes" |

#### Tag
| Page | Route | File | BC? | Pattern | Label | Root |
|---|---|---|---|---|---|---|
| Detail | `/tag/<name>/` | `templates/tag/tag_detail.html` | No | — | — | — |

#### Search
| Page | Route | File | BC? | Pattern | Label | Root |
|---|---|---|---|---|---|---|
| Global | `/search/` | `templates/search/search.html` | No | — | — | — |
| Tag detail | `/search/tagdetail/` | `templates/search/tag_detail.html` | No | — | — | — |
| Semantic | `/search/semantic` | `templates/search/search.html` | No | — | — | — |

---

### Media

#### Music — *worst inconsistency: 3 patterns within one section*
| Page | Route | File | BC? | Pattern | Label | Root |
|---|---|---|---|---|---|---|
| Dashboard | `/music/` | `templates/music/index.html` | No | — | — | — |
| Artist list | `/music/artist_list` | `react/music/ArtistListPage.tsx:102-106` | Yes | MLO | `/bordercore/music/ / artists / <letter>` | path text |
| Artist detail | `/music/artist/<uuid>/` | `templates/music/artist_detail.html:8-16` | Yes | Bootstrap | `[icon] > <name>` | SVG icon |
| Album list | `/music/album_list` | `react/music/AlbumListPage.tsx:88-92` | Yes | MLO | `/bordercore/music/ / albums / <letter>` | path text |
| Album detail | `/music/album/<uuid>/` | `templates/music/album_detail.html:8-19` | Yes | Bootstrap | `[icon] > <artist> > <title>` | SVG icon |
| Album create | `/music/create_album` | `react/music/AlbumCreatePage.tsx:226-233` | Yes | refined h1 | `music / albums / new` | music |
| Song create | `/music/create/` | `react/music/SongCreatePage.tsx:305-308` | Yes | MLO | `/bordercore/music/ / new song` | path text |
| Song edit | `/music/update/<uuid>/` | `react/music/SongEditPage.tsx:277-291` | Yes | MLO | `/bordercore/music/ / <artist> / <album> / edit` | path text |
| Playlist detail | `/music/playlist_detail/<uuid>` | `templates/music/playlist_detail.html:8-17` | Yes | Bootstrap | `[icon] > Playlist: <name>` | SVG icon |
| Tag search | `/music/tag/` | `templates/music/tag_search.html:8-17` | Yes | Bootstrap | `[icon] > Tag: <name>` | SVG icon |
| Recent songs | `/music/recent_songs` | — | No | — | — | — |

---

### Tasks & habits

#### Todo
| Page | Route | File | BC? | Pattern | Label | Root |
|---|---|---|---|---|---|---|
| List | `/todo/` | `react/todo/TodoBreadcrumb.tsx:24-35` | Yes | refined h1 | `All Tasks` or `<filter> / <value>` | none / filter |
| Detail | (overlay) | same | Yes | refined h1 | (same) | (same) |

#### Habit
| Page | Route | File | BC? | Pattern | Label | Root |
|---|---|---|---|---|---|---|
| List | `/habit/` | `templates/habit/list.html` | No | — | — | — |
| Detail | `/habit/<uuid>/` | `react/habit/detail/TopBar.tsx:22-27` | Yes | refined h1 | `habits / <name>` | habits |

#### Drill
| Page | Route | File | BC? | Pattern | Label | Root |
|---|---|---|---|---|---|---|
| List | `/drill/` | `templates/drill/drill_list.html` | No | — | — | — |
| Question detail | `/drill/question/<uuid>/` | `templates/drill/question.html` | No | — | — | — |
| Question create | `/drill/question/add/` | `templates/drill/question_edit.html:70-73` | Yes | Bootstrap | `Drill > Add Question` | Drill |
| Question edit | `/drill/question/update/<uuid>/` | `templates/drill/question_edit.html:70-73` | Yes | Bootstrap | `Drill > Edit Question` | Drill |

#### Fitness
| Page | Route | File | BC? | Pattern | Label | Root |
|---|---|---|---|---|---|---|
| Summary | `/fitness/` | `templates/fitness/summary.html` | No | — | — | — |
| Exercise detail | `/fitness/<uuid>/` | `react/fitness/ExerciseDetailPage.tsx:75-80` | Yes | section-specific (`.ex-breadcrumb`) | `fitness / exercises / <name>` | fitness |

---

### Other

| Section | Pages | BC coverage |
|---|---|---|
| Feed | `/feed/` | None |
| Reminder | list / create / detail / update | None |
| Metrics | `/metrics/` | None |
| Homepage / dashboard | `/`, `/gallery`, `/sql` | None |
| Visualize | `/visualize/` | None |
| Accounts / prefs | `/accounts/login/`, `/accounts/prefs/`, `/accounts/password/` | None |
| Books | `/books/` | None (simplified view, not a full app) |

---

## Coverage gap summary

- **78 pages enumerated across 18 sections.**
- **24 (≈31%) have a breadcrumb. 54 (≈69%) do not.**
- **Zero coverage:** feed, reminder, metrics, homepage/gallery/sql, visualize, accounts, search, tag, books.
- **Partial coverage:** blob (1/8), bookmark (1/3), collection (2/5), node (1/2), drill (2/4), fitness (1/2), habit (1/2).
- **Near-complete coverage:** todo (1/1 effective), music (10/11 — but with 3 different patterns).

---

## Label vocabulary in use today

Distinct root-link styles, ordered by frequency:

| Rank | Root label | Pages | Notes |
|---|---|---|---|
| 1 | `/bordercore/music/` (path text) | 5 | MLO pattern |
| 2 | SVG home icon (music-only) | 4 | Bootstrap pattern |
| 3 | `Drill` | 2 | Capitalized |
| 4 | `bookmarks` | 1 | |
| 5 | `blobs` | 1 | |
| 6 | `blob` (singular!) | 1 | Notes landing — collides with #5 |
| 7 | `music` | 1 | Album create — collides with #1 |
| 8 | `collections` | 1 | Collection detail |
| 9 | `knowledge` | 1 | Collection list — collides with #8 |
| 10 | icon + `nodes` | 1 | |
| 11 | `fitness` | 1 | |
| 12 | `habits` | 1 | |
| 13 | none / dynamic filter label | 1 | Todo list |

### Notable label collisions and oddities

- **Collection** uses two different roots inside the same section: `knowledge` on the list page, `collections` on the detail page.
- **Music** uses three different roots: `/bordercore/music/` (MLO), SVG icon (Bootstrap), and plain `music` (refined h1).
- **Blob** uses two different roots: `blobs` on edit, `blob` (singular) on notes landing.
- **No section currently uses a top-level `Home` link.**
- **Pluralization is inconsistent:**
  - Plural: `blobs`, `bookmarks`, `collections`, `nodes`, `habits`
  - Singular: `music`, `fitness`, `blob` (notes landing)
  - Capitalized: `Drill`

---

## Three decisions before implementation

### 1. Pick one pattern

**Recommendation: refined h1** (`<h1 class="refined-breadcrumb-h1">` with `.dim` / `.sep` / `.current` spans).

Why:
- Newest pattern in the codebase; aligns with the "refined" design-system direction.
- Already used by 6 disparate features (Todos, Bookmarks, Habits, Notes, Blobs, Album Create).
- No Bootstrap coupling.
- Works in both list and detail contexts.
- Doubles as the page heading — reduces visual noise vs. a separate breadcrumb bar above an `<h1>`.

Retire: Bootstrap classic, MLO, all section-specific custom variants.

### 2. Pick one root vocabulary

Two sub-decisions:

**A. Where do breadcrumbs start?**
- Today nothing uses a global `Home` link.
- Section-level rooting is the de facto convention; staying there is the cheaper migration.

**B. Casing and pluralization rule.**
Lowercase plural is the dominant pattern. Proposed canonical roots:

| Section | Canonical root |
|---|---|
| Blob | `blobs` |
| Notes (subsection of blob) | `blobs / notes` |
| Bookmark | `bookmarks` |
| Collection | `collections` |
| Node | `nodes` |
| Tag | `tags` |
| Music | `music` |
| Todo | `todos` |
| Habit | `habits` |
| Drill | `drill` *(no natural plural)* |
| Fitness | `fitness` *(mass noun)* |
| Feed | `feeds` |
| Reminder | `reminders` |
| Metrics | `metrics` |
| Search | `search` |
| Visualize | `visualize` |
| Settings | `settings` |

### 3. Decide rollout scope and staging

A 31% → 100% rollout is a meaningful chunk of work. Suggested staging:

1. **Phase 1 — Unify the existing 24 pages** on the refined h1 with the chosen vocabulary. Net new code: zero. Net new visual coverage: zero. Pure consistency win.
2. **Phase 2 — Backfill list/create pages** in sections that already have detail/edit covered (blob, bookmark, collection, node, drill, fitness, habit).
3. **Phase 3 — Backfill zero-coverage sections** (feed, reminder, metrics, search, tag, accounts, visualize, homepage).

---

## Source references

### Django templates with breadcrumbs
- `templates/music/artist_detail.html:8-16`
- `templates/music/album_detail.html:8-19`
- `templates/music/playlist_detail.html:8-17`
- `templates/music/tag_search.html:8-17`
- `templates/drill/question_edit.html:70-73`
- `templates/collection/collection_detail.html:7-11`

### React components with breadcrumbs
- `front-end/react/todo/TodoBreadcrumb.tsx:24-35`
- `front-end/react/bookmark/BookmarkEditPage.tsx:159-176`
- `front-end/react/node/NodeDetailPage.tsx:829-835`
- `front-end/react/fitness/ExerciseDetailPage.tsx:75-80`
- `front-end/react/music/PageHead.tsx:81-90`
- `front-end/react/music/ArtistListPage.tsx:102-106`
- `front-end/react/music/AlbumListPage.tsx:88-92`
- `front-end/react/music/SongCreatePage.tsx:305-308`
- `front-end/react/music/SongEditPage.tsx:277-291`
- `front-end/react/music/AlbumCreatePage.tsx:226-233`
- `front-end/react/note/landing/NotesLandingPage.tsx:33-41`
- `front-end/react/habit/detail/TopBar.tsx:22-27`
- `front-end/react/blob/BlobUpdatePage.tsx:426-435`
- `front-end/react/collection/CollectionListPage.tsx:48-51`

### Styling sources
- `static/scss/components/_refined-components.scss:259` — `.refined-breadcrumb-h1` ⭐
- `static/scss/pages/_music-library-os.scss:35+` — `.mlo-breadcrumb*`
- `static/scss/pages/_node-detail-refined.scss:102+` — `.nd-crumb*`
- `static/scss/pages/_exercise-detail-refined.scss:82+` — `.ex-breadcrumb`
- `static/scss/pages/_blob-edit-refined.scss:105+` — `.be-crumb`
- `static/scss/pages/_collection-detail-curate.scss:645+` — `.cd-crumbs`
- `static/scss/pages/_collections.scss:197+` — `.cl-crumb*`
- `static/scss/pages/_notes-landing.scss:47+` — `.nl-breadcrumb*`
