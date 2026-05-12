# React Usage Documentation

This document provides comprehensive details about how React is used and configured in this project.

## Table of Contents

1. [Overview](#overview)
2. [Configuration Files](#configuration-files)
3. [Build System: Vite](#build-system-vite)
4. [Entry Points](#entry-points)
5. [Component Structure](#component-structure)
6. [State Management](#state-management)
7. [Django Integration](#django-integration)
8. [Development Workflow](#development-workflow)
9. [Production Build](#production-build)
10. [Code Flow](#code-flow)
11. [Key Patterns and Practices](#key-patterns-and-practices)

## Overview

This project uses **React 18** with **TypeScript** and **Vite** as the build tool.

### Technology Stack

- **React**: 18.2.0 (with `react-dom/client` API)
- **TypeScript**: 5.3.3
- **Vite**: 5.1.0
- **Build Tool**: Vite
- **State Management**: React Context API (`BaseStore`)
- **UI Libraries**: Bootstrap 5, FontAwesome (React version)
- **HTTP Client**: Axios
- **Additional Libraries**: react-select, react-pro-sidebar, @tanstack/react-table, recharts, prismjs, markdown-it, @dnd-kit

## Configuration Files

### TypeScript Configuration (`tsconfig.json`)

Located at: `bordercore/tsconfig.json`

```5:18:bordercore/tsconfig.json
    "jsx": "react-jsx",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["front-end/*"]
    }
  },
  "include": ["front-end/**/*.ts", "front-end/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

Key settings:
- `jsx: "react-jsx"` - Uses the new JSX transform (no need to import React in every file)
- `paths` - Enables `@/*` alias for imports from `front-end/` directory
- Only TypeScript/TSX files in `front-end/` are included

### Package Configuration (`package.json`)

Key React dependencies:

```89:93:bordercore/package.json
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "react-jinke-music-player": "^4.24.2",
        "react-pro-sidebar": "^1.1.0",
        "react-select": "^5.10.2",
```

React-specific dev dependencies:

```36:39:bordercore/package.json
        "@types/react": "^18.2.37",
        "@types/react-dom": "^18.2.15",
        "@typescript-eslint/parser": "^8.54.0",
        "@vitejs/plugin-react": "^4.2.0",
```

NPM scripts for React development:

```13:16:bordercore/package.json
        "vite:dev": "vite",
        "vite:build": "vite build",
        "vite:serve": "vite preview --strictPort",
        "vite:dev-css": "node ./front-end/entries/bordercore-css.js",
```

Formatting and linting scripts for React code:

```19:21:bordercore/package.json
        "format:react": "prettier --write \"front-end/react/**/*.{ts,tsx,jsx,js}\"",
        "format:check:react": "prettier --check \"front-end/react/**/*.{ts,tsx,jsx,js}\"",
        "lint:react": "eslint --no-eslintrc -c .eslintrc.react.json \"front-end/react/**/*.{ts,tsx,jsx}\"",
```

## Build System: Vite

### Vite Configuration (`vite.config.js`)

Located at: `bordercore/vite.config.js`

Vite is configured for React:

```9:13:bordercore/vite.config.js
module.exports = defineConfig({
  plugins: [
    react({
      include: /\.(jsx|tsx)$/,
    }),
  ],
```

Key configuration details:

1. **Plugins**:
   - `@vitejs/plugin-react` - Processes `.jsx` and `.tsx` files with React Refresh support

2. **Base Path**:
   ```15:15:bordercore/vite.config.js
   base: isProduction ? "/static/vite/" : "/",
   ```
   - Development: Served from root `/`
   - Production: Served from `/static/vite/`

3. **Development Server**:
   ```18:25:bordercore/vite.config.js
   server: {
     port: 5173,
     strictPort: true,
     cors: true,
     hmr: {
       host: "localhost",
       port: 5173,
     },
   },
   ```
   - Runs on port 5173
   - Hot Module Replacement (HMR) enabled
   - CORS enabled for Django integration

4. **Build Output**:
   ```28:31:bordercore/vite.config.js
   build: {
     outDir: path.resolve(__dirname, "static", "vite"),
     emptyOutDir: true,
     manifest: true,
   ```
   - Builds to `static/vite/`
   - `emptyOutDir: true` - Clears the output directory before building
   - Generates manifest.json for Django integration

5. **Rollup Entry Points**: The config defines 46 entry points across all app areas:

   | Category | Entry Names |
   |----------|-------------|
   | **CSS** | `dist/css/bordercore` |
   | **Base** | `dist/js/base-react`, `dist/js/login` |
   | **Blob** | `dist/js/blob-list`, `dist/js/blob-detail`, `dist/js/blob-import`, `dist/js/blob-update`, `dist/js/bookshelf` |
   | **Book** | `dist/js/book-list` |
   | **Bookmark** | `dist/js/bookmark-list`, `dist/js/bookmark-form` |
   | **Collection** | `dist/js/collection-list`, `dist/js/collection-detail` |
   | **Drill** | `dist/js/drill-list`, `dist/js/drill-question`, `dist/js/drill-question-edit` |
   | **Feed** | `dist/js/feed` |
   | **Fitness** | `dist/js/fitness-summary`, `dist/js/fitness-exercise-detail` |
   | **Habit** | `dist/js/habit-list`, `dist/js/habit-detail` |
   | **Homepage** | `dist/js/homepage`, `dist/js/gallery`, `dist/js/sql` |
   | **Metrics** | `dist/js/metric-list` |
   | **Music** | `dist/js/music-dashboard`, `dist/js/album-list`, `dist/js/album-detail`, `dist/js/album-create`, `dist/js/artist-detail`, `dist/js/song-edit`, `dist/js/song-create`, `dist/js/playlist-detail`, `dist/js/tag-search` |
   | **Node** | `dist/js/node-list`, `dist/js/node-detail` |
   | **Note** | `dist/js/note-list` |
   | **Prefs** | `dist/js/prefs`, `dist/js/prefs-password` |
   | **Reminder** | `dist/js/reminders`, `dist/js/reminder-detail`, `dist/js/reminder-form`, `dist/js/reminder-delete` |
   | **Search** | `dist/js/search`, `dist/js/tag-detail`, `dist/js/tag-list` |
   | **Todo** | `dist/js/todos` |

   Each JS entry resolves to `front-end/entries/<name>.tsx` and each CSS entry to `front-end/entries/<name>-css.js`.

6. **Manual Chunks**: Vendor libraries are split into separate chunks for caching:
   - `react-select` - React Select component
   - `prismjs` - Syntax highlighting with language modules (Python, Bash, SQL, JSON, YAML, Go, Rust, Java, TypeScript, C, C++, Ruby, Markdown)

## Entry Points

Entry points are located in `bordercore/front-end/entries/`. Each entry point is a separate bundle that can be loaded independently. There are currently 48 entry files.

### 1. `base-react.tsx` (Core)

**Purpose**: Main React entry point for base template components (sidebar, top bar, toast, etc.). Loaded on every page.

**Mount Points**: Mounts React components to five DOM elements:
- `#react-toast` - Toast notifications
- `#top-bar` - Top navigation bar (weather, search, recent blobs, user menu, overdue tasks)
- `#sidebar` - Sidebar navigation menu
- `#chat-bot` - ChatBot component
- `#global-audio-player` - Global music audio player

**Key Components**:
- `TopBarContent` - Top navigation with weather, search, recent blobs, user menu, overdue tasks
- `SidebarContent` - Sidebar menu with navigation items (uses `useBaseStore()` for collapse state)
- `ChatBotContent` - AI chatbot interface
- `GlobalAudioPlayer` - Music player
- `Toast` - Notification system

**Global Setup** (lines 27-33):
```27:33:bordercore/front-end/entries/base-react.tsx
// Set up globals for compatibility with code that expects them
if (typeof window !== "undefined") {
  window.EventBus = EventBus;
  window.doGet = doGet;
  window.doPost = doPost;
  window.markdown = markdown;
}
```

**Mount Structure** (lines 438-489):

Each component is mounted independently via separate `createRoot()` calls, each wrapped in its own `BaseStoreProvider`:

```438:489:bordercore/front-end/entries/base-react.tsx
// Mount components to their respective DOM elements
const toastContainer = document.getElementById("react-toast");
if (toastContainer) {
  const toastRoot = createRoot(toastContainer);
  const data = window.BASE_TEMPLATE_DATA || {};
  toastRoot.render(
    <BaseStoreProvider initialCollapsed={data.initialSidebarCollapsed || false}>
      <Toast initialMessages={data.initialMessages || []} />
    </BaseStoreProvider>
  );
}

const topBarContainer = document.getElementById("top-bar");
if (topBarContainer) {
  // Read title from server-rendered span before React replaces it
  const originalTitleEl = document.getElementById("top-title-text");
  if (originalTitleEl?.textContent?.trim()) {
    window.BASE_TEMPLATE_DATA = window.BASE_TEMPLATE_DATA || {};
    window.BASE_TEMPLATE_DATA.title = originalTitleEl.textContent.trim();
  }

  const topBarRoot = createRoot(topBarContainer);
  const data = window.BASE_TEMPLATE_DATA || {};
  topBarRoot.render(
    <BaseStoreProvider initialCollapsed={data.initialSidebarCollapsed || false}>
      <TopBarContent />
    </BaseStoreProvider>
  );
}

const sidebarContainer = document.getElementById("sidebar");
if (sidebarContainer) {
  const sidebarRoot = createRoot(sidebarContainer);
  const data = window.BASE_TEMPLATE_DATA || {};
  sidebarRoot.render(
    <BaseStoreProvider initialCollapsed={data.initialSidebarCollapsed || false}>
      <SidebarContent />
    </BaseStoreProvider>
  );
}

const chatBotContainer = document.getElementById("chat-bot");
if (chatBotContainer) {
  const chatBotRoot = createRoot(chatBotContainer);
  chatBotRoot.render(<ChatBotContent />);
}

const audioPlayerContainer = document.getElementById("global-audio-player");
if (audioPlayerContainer) {
  const audioPlayerRoot = createRoot(audioPlayerContainer);
  audioPlayerRoot.render(<GlobalAudioPlayer />);
}
```

### 2. `reminders.tsx`

**Purpose**: Standalone entry point for the Reminders list page

**Mount Point**: `#react-root`

```1:23:bordercore/front-end/entries/reminders.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import RemindersPage from "../react/reminder/RemindersPage";

// Get URLs from data attributes or BASE_TEMPLATE_DATA
const container = document.getElementById("react-root");
if (container) {
  // Try to get URLs from data attributes first
  const listAjaxUrl = container.getAttribute("data-list-ajax-url") || "";
  const createUrl = container.getAttribute("data-create-url") || "";

  // Fallback to BASE_TEMPLATE_DATA if available
  const data = (window as any).BASE_TEMPLATE_DATA || {};
  const finalListAjaxUrl = listAjaxUrl || data.reminderListAjaxUrl || "";
  const finalCreateUrl = createUrl || data.reminderCreateUrl || "";

  if (finalListAjaxUrl && finalCreateUrl) {
    const root = createRoot(container);
    root.render(<RemindersPage listAjaxUrl={finalListAjaxUrl} createUrl={finalCreateUrl} />);
  } else {
    console.error("RemindersPage: Missing required URLs. listAjaxUrl:", finalListAjaxUrl, "createUrl:", finalCreateUrl);
  }
}
```

### 3. `react-app.tsx`

**Purpose**: Generic React app entry point (currently minimal/placeholder implementation)

**Mount Point**: `#react-root`

```6:14:bordercore/front-end/entries/react-app.tsx
const App = () => (
  <div>
  </div>
);

const container = document.getElementById("react-root");
if (container) {
  createRoot(container).render(<App />);
}
```

### 4. Page-Specific Entry Points

Most entry points follow a consistent pattern: read URLs/data from `data-*` attributes on the `#react-root` container, then render a page component. Examples:

- **`todos.tsx`** - Todo list page with `TodoListPage`
- **`blob-detail.tsx`** - Blob detail page with `BlobDetailPage`
- **`music-dashboard.tsx`** - Music dashboard with `MusicDashboardPage`
- **`search.tsx`** - Search results with `SearchPage`
- **`homepage.tsx`** - Homepage with `HomepagePage`

## Component Structure

React components are organized in `bordercore/front-end/react/`:

```
front-end/react/
├── accounts/
│   └── LoginPage.tsx
├── blob/
│   ├── AddToCollectionModal.tsx
│   ├── BlobDetailCover.tsx
│   ├── BlobDetailPage.tsx
│   ├── BlobImportPage.tsx
│   ├── BlobListPage.tsx
│   ├── BlobUpdatePage.tsx
│   ├── BookshelfPage.tsx
│   ├── ChatBot.tsx
│   ├── CollectionsCard.tsx
│   ├── IconButton.tsx
│   ├── MarkdownEditor.tsx
│   ├── RecentBlobs.tsx
│   └── types.ts
├── book/
│   └── BookListPage.tsx
├── bookmark/
│   ├── BookmarkFormPage.tsx
│   ├── BookmarkList.tsx
│   ├── BookmarkListPage.tsx
│   ├── BookmarkPagination.tsx
│   ├── BookmarkPinnedTags.tsx
│   ├── BookmarkStatsCards.tsx
│   ├── index.ts
│   └── types.ts
├── collection/
│   ├── CollectionCard.tsx
│   ├── CollectionDetailPage.tsx
│   ├── CollectionListPage.tsx
│   ├── CollectionObjectGrid.tsx
│   ├── CreateCollectionModal.tsx
│   ├── DeleteCollectionModal.tsx
│   ├── EditCollectionModal.tsx
│   ├── ImageViewModal.tsx
│   ├── SlideShowModal.tsx
│   ├── SlideShowOverlay.tsx
│   └── types.ts
├── common/
│   ├── BackReferences.tsx
│   ├── Card.tsx
│   ├── DropDownMenu.tsx
│   ├── ObjectSelectModal.tsx
│   ├── Popover.tsx
│   ├── PythonConsole.tsx
│   ├── RelatedObjects.tsx
│   ├── RelatedTags.tsx
│   ├── SelectValue.tsx
│   ├── SidebarMenu.tsx
│   ├── SqlEditor.tsx
│   ├── TagsInput.tsx
│   ├── Toast.tsx
│   ├── ToggleSwitch.tsx
│   ├── TreeMenu.tsx
│   ├── Weather.tsx
│   └── index.ts
├── drill/
│   ├── DrillDisabledTags.tsx
│   ├── DrillListPage.tsx
│   ├── DrillPinnedTags.tsx
│   ├── DrillQuestionEditPage.tsx
│   ├── DrillQuestionPage.tsx
│   └── index.ts
├── feed/
│   ├── FeedEditorModal.tsx
│   ├── FeedItemList.tsx
│   ├── FeedList.tsx
│   ├── FeedPage.tsx
│   └── types.ts
├── fitness/
│   ├── AddWorkoutForm.tsx
│   ├── ExerciseDetailPage.tsx
│   ├── FitnessSummaryPage.tsx
│   ├── LastWorkout.tsx
│   ├── Schedule.tsx
│   ├── WorkoutGraph.tsx
│   └── types.ts
├── habit/
│   ├── HabitDetailPage.tsx
│   └── HabitListPage.tsx
├── homepage/
│   ├── CalendarCard.tsx
│   ├── DataTable.tsx
│   ├── DrillTagProgress.tsx
│   ├── GalleryPage.tsx
│   ├── HomepagePage.tsx
│   ├── SqlPlaygroundPage.tsx
│   └── types.ts
├── metrics/
│   └── MetricListPage.tsx
├── music/
│   ├── AddToPlaylistModal.tsx
│   ├── AlbumCreatePage.tsx
│   ├── AlbumDetailPage.tsx
│   ├── AlbumGrid.tsx
│   ├── AlbumListPage.tsx
│   ├── ArtistDetailPage.tsx
│   ├── ArtistSongTable.tsx
│   ├── CreatePlaylistModal.tsx
│   ├── EditAlbumModal.tsx
│   ├── EditArtistImageModal.tsx
│   ├── EditPlaylistModal.tsx
│   ├── FeaturedAlbumCard.tsx
│   ├── GlobalAudioPlayer.tsx
│   ├── MusicDashboardPage.tsx
│   ├── PlaylistDetailPage.tsx
│   ├── PlaylistSongTable.tsx
│   ├── PlaylistsCard.tsx
│   ├── RecentAlbumsCard.tsx
│   ├── RecentSongsTable.tsx
│   ├── RecentlyPlayedSongsCard.tsx
│   ├── SongCreatePage.tsx
│   ├── SongEditPage.tsx
│   ├── SongTable.tsx
│   ├── StarRating.tsx
│   ├── TagSearchPage.tsx
│   └── types.ts
├── node/
│   ├── NodeCollectionCard.tsx
│   ├── NodeCollectionModal.tsx
│   ├── NodeDetailPage.tsx
│   ├── NodeImage.tsx
│   ├── NodeImageModal.tsx
│   ├── NodeListPage.tsx
│   ├── NodeNode.tsx
│   ├── NodeNodeModal.tsx
│   ├── NodeNote.tsx
│   ├── NodeNoteModal.tsx
│   ├── NodeQuote.tsx
│   ├── NodeQuoteModal.tsx
│   ├── NodeTodoList.tsx
│   └── types.ts
├── note/
│   ├── NoteListPage.tsx
│   └── types.ts
├── prefs/
│   ├── FileUploadField.tsx
│   ├── PasswordChangePage.tsx
│   └── PreferencesPage.tsx
├── reminder/
│   ├── ReminderDeletePage.tsx
│   ├── ReminderDetailPage.tsx
│   ├── ReminderFormPage.tsx
│   ├── RemindersPage.tsx
│   └── RemindersTable.tsx
├── search/
│   ├── DoctypeSidebar.tsx
│   ├── Pagination.tsx
│   ├── SearchBar.tsx
│   ├── SearchNoResult.tsx
│   ├── SearchPage.tsx
│   ├── SearchResult.tsx
│   ├── TagDetailPage.tsx
│   ├── TagSearchResult.tsx
│   ├── TopSearch.tsx
│   └── types.ts
├── stores/
│   └── BaseStore.tsx
├── tag/
│   ├── AddTagAliasModal.tsx
│   ├── TagAliasTable.tsx
│   ├── TagListPage.tsx
│   └── types.ts
├── todo/
│   ├── OverdueTasks.tsx
│   ├── TodoEditor.tsx
│   ├── TodoFiltersSidebar.tsx
│   ├── TodoListPage.tsx
│   ├── TodoTable.tsx
│   └── types.ts
└── utils/
    ├── reactUtils.ts
    └── tagColors.ts
```

### Component Organization

- **`accounts/`** - Authentication (login page)
- **`blob/`** - Blob CRUD, bookshelf, chatbot, markdown editor, collections integration
- **`book/`** - Book list page
- **`bookmark/`** - Bookmark CRUD, pagination, pinned tags, stats
- **`collection/`** - Collection CRUD, object grid, slideshow, image viewer
- **`common/`** - Shared/reusable components (Card, DropDownMenu, Toast, Weather, TagsInput, SqlEditor, TreeMenu, etc.)
- **`drill/`** - Spaced repetition drill system
- **`feed/`** - RSS/Atom feed reader
- **`fitness/`** - Workout tracking, exercise details, graphs, schedules
- **`habit/`** - Habit tracking list and detail
- **`homepage/`** - Homepage dashboard, gallery, SQL playground, calendar
- **`metrics/`** - Metrics/test results dashboard
- **`music/`** - Full music library management (albums, artists, songs, playlists, audio player)
- **`node/`** - Knowledge node system with notes, quotes, images, collections, todos
- **`note/`** - Note list page
- **`prefs/`** - User preferences and password change
- **`reminder/`** - Reminder CRUD
- **`search/`** - Full-text search, tag search, tag detail pages
- **`stores/`** - State management (React Context)
- **`tag/`** - Tag management with aliases
- **`todo/`** - Todo CRUD with filters, editor, and table view
- **`utils/`** - Utility functions, HTTP helpers, tag color utilities

## State Management

### BaseStore (React Context)

Located at: `bordercore/front-end/react/stores/BaseStore.tsx`

The project uses React Context API for global state management. `BaseStore` manages sidebar collapse state.

**Store Structure**:
```3:7:bordercore/front-end/react/stores/BaseStore.tsx
interface BaseStoreContextType {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}
```

**Provider Component**:
```11:35:bordercore/front-end/react/stores/BaseStore.tsx
export function BaseStoreProvider({
  children,
  initialCollapsed = false,
}: {
  children: ReactNode;
  initialCollapsed?: boolean;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialCollapsed);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  return (
    <BaseStoreContext.Provider
      value={{
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
      }}
    >
      {children}
    </BaseStoreContext.Provider>
  );
}
```

**Usage Hook**:
```37:43:bordercore/front-end/react/stores/BaseStore.tsx
export function useBaseStore() {
  const context = useContext(BaseStoreContext);
  if (context === undefined) {
    throw new Error("useBaseStore must be used within a BaseStoreProvider");
  }
  return context;
}
```

**Example Usage in Component** (`SidebarContent` uses `useBaseStore()`):
```238:239:bordercore/front-end/entries/base-react.tsx
function SidebarContent() {
  const { sidebarCollapsed, setSidebarCollapsed } = useBaseStore();
```

## Django Integration

### Template Tag: `vite_asset`

Located at: `bordercore/lib/templatetags/vite_tags.py`

The `vite_asset` template tag loads React bundles in Django templates. It handles both development and production modes.

**Source Path Resolution** (`_get_source_path` function):

Instead of a hardcoded mapping, the tag derives source paths from entry names using naming conventions:

```93:116:bordercore/lib/templatetags/vite_tags.py
def _get_source_path(entry_name: str) -> str:
    """Derive the source file path from a build entry name.

    Converts build output names to source paths using naming conventions:
    - dist/js/javascript -> front-end/index.js (legacy entry point)
    - dist/css/* -> front-end/entries/*-css.js
    - dist/js/* -> front-end/entries/*.tsx
    """
    # Special case for legacy main entry point
    if entry_name == "dist/js/javascript":
        return "front-end/index.js"

    # CSS entries: dist/css/foo -> front-end/entries/foo-css.js
    if entry_name.startswith("dist/css/"):
        name = entry_name.replace("dist/css/", "")
        return f"front-end/entries/{name}-css.js"

    # JS/React entries: dist/js/foo -> front-end/entries/foo.tsx
    if entry_name.startswith("dist/js/"):
        name = entry_name.replace("dist/js/", "")
        return f"front-end/entries/{name}.tsx"

    # Fallback: return as-is (already a source path)
    return entry_name
```

**Development Mode** (when `settings.DEBUG = True`):
```137:158:bordercore/lib/templatetags/vite_tags.py
    if settings.DEBUG and not use_manifest:
        # Derive source path from entry name using naming conventions
        source_path = _get_source_path(entry_name)

        # Add Vite client for HMR
        parts.append('<script type="module" src="http://localhost:5173/@vite/client"></script>')

        # Add React Refresh preamble (required by @vitejs/plugin-react)
        # This must be added before any React components are loaded
        if "react" in entry_name or "react" in source_path or source_path.endswith(".tsx") or source_path.endswith(".jsx"):
            parts.append('''<script type="module">
  import { injectIntoGlobalHook } from "http://localhost:5173/@react-refresh"
  injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>''')

        # Add the entry point
        parts.append(f'<script type="module" src="http://localhost:5173/{source_path}"></script>')

        return mark_safe("\n".join(parts))
```

**Production Mode** (uses manifest.json):
```160:192:bordercore/lib/templatetags/vite_tags.py
    # Production: use manifest
    manifest = _load_manifest()
    if not manifest:
        logger.error(f"Manifest is empty, cannot load asset: {entry_name}")
        return ""

    entry = None
    # Direct key lookup (Vite 5 uses src path as key)
    if entry_name in manifest:
        entry = manifest[entry_name]
    else:
        # Fallback: search by "name" field (for legacy entry names like "dist/js/react-app")
        for key, value in manifest.items():
            if value.get("name") == entry_name:
                entry = value
                break

    if not entry:
        logger.error(f"Entry '{entry_name}' not found in manifest. Available entries: {list(manifest.keys())[:10]}")
        return ""

    parts.clear()
    static_base = settings.STATIC_URL.rstrip("/") + "/vite/"
    # CSS
    for css in entry.get("css", []):
        href = static_base + css
        parts.append(f'<link rel="stylesheet" href="{href}">')
    # JS
    js_file = entry.get("file")
    if js_file:
        src = static_base + js_file
        parts.append(f'<script type="module" src="{src}"></script>')
    return mark_safe("\n".join(parts))
```

### Base Template: `base.html`

Located at: `bordercore/templates/base.html`

The base template provides:

1. **DOM Mount Points** for React components:
   ```37:88:bordercore/templates/base.html
       <div id="react-toast"></div>
       ...
           <div id="top-bar" class="top-bar-container py-0 mb-0">
               ...
           </div>
           <div id="overdue-tasks"></div>
       ...
       <div id="sidebar"></div>
       <div id="global-audio-player"></div>
       ...
       <div id="chat-bot"></div>
   ```

2. **BASE_TEMPLATE_DATA** - Passes Django context data to React:
   ```121:195:bordercore/templates/base.html
               window.BASE_TEMPLATE_DATA = {
                   staticUrl: "{{ STATIC_URL }}",
                   csrfToken: "{{ csrf_token }}",
                   initialSidebarCollapsed: {% if request.session.show_sidebar == "false" %}true{% else %}false{% endif %},
                   failedTestCount: {{ failed_test_count }},
                   title: "",
                   username: "{{ user.get_username }}",
                   userMenuItems: [
                       {
                           id: generateUUID(),
                           title: "Preferences",
                           url: "{% url 'accounts:prefs' %}",
                           icon: "briefcase"
                       },
                       {% if request.user|is_in_group:"Admin" %}
                       {
                           id: generateUUID(),
                           title: "Metrics",
                           url: "{% url 'metrics:list' %}",
                           icon: "chart-bar",
                           extra: {{ failed_test_count }}
                       },
                       {% endif %}
                       {
                           id: generateUUID(),
                           title: "ChatBot",
                           url: "#",
                           icon: "comment",
                           clickHandler: "handleChatBot"
                       },
                       {
                           id: generateUUID(),
                           title: "Help",
                           url: "#",
                           icon: "question",
                           clickHandler: "showHelp"
                       },
                       {
                           id: generateUUID(),
                           title: "Logout",
                           url: "{% url 'accounts:logout' %}",
                           icon: "sign-out-alt",
                       },
                   ],
                   topSearchConfig: {
                       initialSearchFilter: "{{ request.session.top_search_filter }}",
                       initialSearchUrl: "{% url 'search:search_tags_and_names' %}",
                       querySearchUrl: "{% url 'search:search' %}",
                       noteQuerySearchUrl: "{% url 'search:notes' %}",
                       drillQuerySearchUrl: "{% url 'search:search' %}",
                       storeInSessionUrl: "{% url "accounts:store_in_session" %}",
                   },
                   chatBotConfig: {
                       blobUuid: "{{ blob.uuid|default:'' }}",
                       chatUrl: "{% url 'blob:chat' %}",
                       csrfToken: "{{ csrf_token }}",
                   },
                   overdueTasksConfig: {
                       rescheduleTaskUrl: "{% url 'todo:snooze_task' %}",
                       deleteTodoUrl: "{% url 'todo-detail' '00000000-0000-0000-0000-000000000000' %}",
                   },
                   recentBlobsConfig: {
                       blobDetailUrl: "{% url 'blob:detail' '00000000-0000-0000-0000-000000000000' %}",
                   },
                   sidebarConfig: {
                       storeInSessionUrl: "{% url "accounts:store_in_session" %}",
                       getNewBookmarksCountUrl: "{% url "bookmark:get_new_bookmarks_count" 666 %}",
                       todoCount: {{ todo_count|default:0 }},
                       exerciseCount: {{ exercise_count|default:0 }},
                   },
                   urls: {
                       getWeather: "{% url 'accounts:get_weather' %}",
                   },
                   initialMessages: {{ json_messages|safe }},
               };
   ```

3. **Vite Asset Loading**:
   ```198:200:bordercore/templates/base.html
           {% block javascript_bundles %}
               {% vite_asset "dist/js/base-react" %}
           {% endblock %}
   ```

4. **JSON Script Tags** - Passes data via Django's `json_script` filter:
   ```202:210:bordercore/templates/base.html
           {{ recent_blobs|json_script:"recent_blobs" }}
           {{ recent_bookmarks|json_script:"recent-bookmarks" }}
           {{ recent_media|json_script:"recent_media" }}
           {{ overdue_tasks|json_script:"overdue_tasks" }}
           {{ recent_searches|json_script:"recent_searches" }}
           {{ recently_viewed|json_script:"recently_viewed" }}
           {% if user.userprofile.weather %}
           {{ user.userprofile.weather|json_script:"weather_info" }}
           {% endif %}
   ```

   These JSON script tags are read by React components using `document.getElementById()` and `JSON.parse()`.

### Example: Reminders Page Template

Located at: `bordercore/templates/reminder/index.html`

Shows how to extend `base.html` and add a page-specific React component:

```1:17:bordercore/templates/reminder/index.html
{% extends "base.html" %}
{% load vite_tags %}

{% block title %}Reminders{% endblock %}

{% block css %}
    {% vite_asset "dist/css/bordercore" %}
{% endblock %}

{% block javascript_bundles %}
    {{ block.super }}
    {% vite_asset "dist/js/reminders" %}
{% endblock %}

{% block content %}
  <div id="react-root" data-list-ajax-url="{% url 'reminder:list-ajax' %}" data-create-url="{% url 'reminder:create' %}"></div>
{% endblock %}
```

## Development Workflow

### Starting the Development Server

1. **Start Vite dev server** (from `bordercore/` directory):
   ```bash
   npm run vite:dev
   ```
   This starts Vite on `http://localhost:5173` with HMR enabled.

2. **Start Django development server** (in another terminal):
   ```bash
   python manage.py runserver
   ```

3. **Development Mode Behavior**:
   - React code is served from `http://localhost:5173` (Vite dev server)
   - Django templates load React bundles via `vite_asset` tag
   - Hot Module Replacement (HMR) works automatically
   - React Refresh enables fast refresh of React components
   - Changes to React/TypeScript files trigger automatic browser refresh

### React Refresh

React Refresh is enabled via the Vite React plugin. The `vite_asset` template tag injects the React Refresh preamble in development mode:

```146:153:bordercore/lib/templatetags/vite_tags.py
        if "react" in entry_name or "react" in source_path or source_path.endswith(".tsx") or source_path.endswith(".jsx"):
            parts.append('''<script type="module">
  import { injectIntoGlobalHook } from "http://localhost:5173/@react-refresh"
  injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>''')
```

## Production Build

### Building for Production

Run the Vite build command:

```bash
npm run vite:build
```

This:
1. Compiles TypeScript/TSX files
2. Bundles React components
3. Minifies and optimizes code
4. Outputs to `static/vite/`
5. Generates `manifest.json` at `static/vite/.vite/manifest.json`

### Production Output Structure

```
static/vite/
├── .vite/
│   └── manifest.json          # Maps entry names to built files
├── dist/
│   ├── css/
│   │   └── bordercore-[hash].css
│   └── js/
│       ├── base-react-[hash].js
│       ├── blob-detail-[hash].js
│       ├── music-dashboard-[hash].js
│       ├── todos-[hash].js
│       └── ... (46 entry bundles)
├── react-select-[hash].js    # Vendor chunk
└── prismjs-[hash].js         # Vendor chunk
```

### Manifest File

The manifest.json maps entry names to built files. Example structure:

```json
{
  "front-end/entries/base-react.tsx": {
    "file": "dist/js/base-react-[hash].js",
    "name": "dist/js/base-react",
    "css": ["dist/css/bordercore-[hash].css"]
  }
}
```

The `vite_asset` template tag uses this manifest to load the correct files in production.

## Code Flow

### Page Load Flow (Development)

```
1. User visits Django page
   ↓
2. Django renders template (e.g., base.html)
   ↓
3. Template loads vite_asset "dist/js/base-react"
   ↓
4. vite_tags.py detects DEBUG=True
   ↓
5. _get_source_path() derives "front-end/entries/base-react.tsx"
   ↓
6. Template tag injects:
   - Vite client script (HMR)
   - React Refresh preamble
   - Entry point script from Vite dev server (localhost:5173)
   ↓
7. Browser loads scripts from Vite dev server
   ↓
8. Entry point (base-react.tsx) executes
   ↓
9. createRoot() mounts React components to DOM elements
   ↓
10. Components read window.BASE_TEMPLATE_DATA and JSON script tags
   ↓
11. React renders components
```

### Page Load Flow (Production)

```
1. User visits Django page
   ↓
2. Django renders template
   ↓
3. Template loads vite_asset "dist/js/base-react"
   ↓
4. vite_tags.py detects DEBUG=False
   ↓
5. Template tag reads manifest.json (cached, reloaded on file change)
   ↓
6. Template tag generates <script> tags pointing to static/vite/dist/js/base-react-[hash].js
   ↓
7. Browser loads bundled JavaScript from Django static files
   ↓
8. Entry point executes (same as dev)
   ↓
9. Components mount and render
```

### Component Data Flow

```
Django View/Context
    ↓
Django Template
    ↓ (via json_script filter)
JSON Script Tags in HTML
    ↓ (via document.getElementById + JSON.parse)
React Component State
    ↓
React Component Render
```

**Example from base-react.tsx** (TopBarContent reads JSON script tags):
```58:81:bordercore/front-end/entries/base-react.tsx
  React.useEffect(() => {
    // Load data from json_script tags
    const recentBlobsEl = document.getElementById("recent_blobs");
    const recentlyViewedEl = document.getElementById("recently_viewed");
    const recentSearchesEl = document.getElementById("recent_searches");
    const overdueTasksEl = document.getElementById("overdue_tasks");
    const weatherInfoEl = document.getElementById("weather_info");

    if (recentBlobsEl) {
      setRecentBlobs(JSON.parse(recentBlobsEl.textContent || "{}"));
    }
    if (recentlyViewedEl) {
      setRecentlyViewed(JSON.parse(recentlyViewedEl.textContent || "{}"));
    }
    if (recentSearchesEl) {
      setRecentSearches(JSON.parse(recentSearchesEl.textContent || "[]"));
    }
    if (overdueTasksEl) {
      setOverdueTasks(JSON.parse(overdueTasksEl.textContent || "[]"));
    }
    if (weatherInfoEl) {
      setWeatherInfo(JSON.parse(weatherInfoEl.textContent || "null"));
    }
  }, []);
```

### Event Communication Flow

The project uses an EventBus pattern for component communication:

**EventBus Implementation** (`reactUtils.ts`):
```6:11:bordercore/front-end/react/utils/reactUtils.ts
export const EventBus = {
  $on: (...args: any[]) => emitter.on(...args),
  $once: (...args: any[]) => emitter.once(...args),
  $off: (...args: any[]) => emitter.off(...args),
  $emit: (...args: any[]) => emitter.emit(...args),
};
```

**Usage Example** (Toast component listens for events):
```66:71:bordercore/front-end/react/common/Toast.tsx
      // Listen for toast events from EventBus
      if (window.EventBus) {
        const handler = (payload: ToastMessage) => {
          showToast(payload);
        };
        window.EventBus.$on("toast", handler);
```

**Triggering Events** (from doPost utility):
```120:126:bordercore/front-end/react/utils/reactUtils.ts
      if (response.data.status && response.data.status === "WARNING") {
        EventBus.$emit("toast", {
          title: "Error",
          body: response.data.message,
          variant: "warning",
          autoHide: true,
        });
```

## Key Patterns and Practices

### 1. Multiple Root Mounting

React 18's `createRoot()` API allows multiple root instances. The `base-react.tsx` entry point mounts different components to different DOM containers, each with its own `BaseStoreProvider`:

```438:489:bordercore/front-end/entries/base-react.tsx
// Mount components to their respective DOM elements
const toastContainer = document.getElementById("react-toast");
if (toastContainer) {
  const toastRoot = createRoot(toastContainer);
  // ...
}

const topBarContainer = document.getElementById("top-bar");
if (topBarContainer) {
  const topBarRoot = createRoot(topBarContainer);
  // ...
}

const sidebarContainer = document.getElementById("sidebar");
if (sidebarContainer) {
  const sidebarRoot = createRoot(sidebarContainer);
  // ...
}

const chatBotContainer = document.getElementById("chat-bot");
if (chatBotContainer) {
  const chatBotRoot = createRoot(chatBotContainer);
  // ...
}

const audioPlayerContainer = document.getElementById("global-audio-player");
if (audioPlayerContainer) {
  const audioPlayerRoot = createRoot(audioPlayerContainer);
  // ...
}
```

### 2. Global Window Object for Data

Django passes data to React via `window.BASE_TEMPLATE_DATA`. Components access it like:

```46:47:bordercore/front-end/entries/base-react.tsx
function TopBarContent() {
  const data = window.BASE_TEMPLATE_DATA || {};
```

### 3. JSON Script Tags for Complex Data

Django's `json_script` filter is used for passing complex data structures. React components read them:

```202:207:bordercore/templates/base.html
            {{ recent_blobs|json_script:"recent_blobs" }}
            {{ recent_bookmarks|json_script:"recent-bookmarks" }}
            {{ recent_media|json_script:"recent_media" }}
            {{ overdue_tasks|json_script:"overdue_tasks" }}
            {{ recent_searches|json_script:"recent_searches" }}
            {{ recently_viewed|json_script:"recently_viewed" }}
```

### 4. Data Attributes for Page-Specific Props

Page-specific React components receive props via data attributes:

```16:16:bordercore/templates/reminder/index.html
  <div id="react-root" data-list-ajax-url="{% url 'reminder:list-ajax' %}" data-create-url="{% url 'reminder:create' %}"></div>
```

Read in entry point:
```9:10:bordercore/front-end/entries/reminders.tsx
  const listAjaxUrl = container.getAttribute("data-list-ajax-url") || "";
  const createUrl = container.getAttribute("data-create-url") || "";
```

### 5. CSRF Token Handling

CSRF tokens are extracted from cookies and sent in both headers and form data:

```21:34:bordercore/front-end/react/utils/reactUtils.ts
function getCsrfToken(): string {
  const name = "csrftoken";
  if (typeof document !== "undefined" && document.cookie) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const token = parts.pop()?.split(";").shift();
      if (token) {
        return decodeURIComponent(token);
      }
    }
  }
  return "";
}
```

The token is included in POST/PUT/DELETE requests both as a form field (`csrfmiddlewaretoken`) and as a header (`X-CSRFToken`).

### 6. Global Functions and Objects

React components expose global functions/objects for cross-component access:

```27:33:bordercore/front-end/entries/base-react.tsx
// Set up globals for compatibility with code that expects them
if (typeof window !== "undefined") {
  window.EventBus = EventBus;
  window.doGet = doGet;
  window.doPost = doPost;
  window.markdown = markdown;
}
```

### 7. TypeScript Type Declarations

Global window object is typed for TypeScript:

```35:44:bordercore/front-end/entries/base-react.tsx
// Declare global types for window object
declare global {
  interface Window {
    BASE_TEMPLATE_DATA?: any;
    EventBus?: any;
    doPost?: (url: string, params: any, callback: (response: any) => void) => void;
    doGet?: (url: string, callback: (response: any) => void, errorMsg?: string) => void;
    markdown?: any;
  }
}
```

### 8. HTTP Utility Functions

`reactUtils.ts` provides four HTTP methods, all with automatic toast notifications:

- **`doGet(url, callback, errorMsg?, responseType?)`** - GET requests with error toasts
- **`doPost(url, params, callback, successMsg?, errorMsg?)`** - POST with CSRF, success/warning/error toasts
- **`doPut(url, params, callback, successMsg?, errorMsg?)`** - PUT with CSRF, success/error toasts
- **`doDelete(url, callback, successMsg?)`** - DELETE with CSRF, success/error toasts

All methods use `withCredentials: true` for same-origin cookie handling (except `doGet` which relies on default browser behavior).

## Summary

- **React** uses **Vite** for fast development and modern tooling
- React components integrate seamlessly with Django templates via `base.html`
- Data flows from Django -> Templates -> React via `window.BASE_TEMPLATE_DATA` and JSON script tags
- React Refresh enables fast development iteration
- Production builds use manifest.json for efficient asset loading
- The `_get_source_path()` function dynamically derives source paths from entry names (no hardcoded mapping)
- 46 Vite entry points cover all application areas (blob, music, todo, search, etc.)
- 22 component directories with 160+ TypeScript/TSX files
- EventBus pattern enables cross-component communication
- HTTP utilities (`doGet`, `doPost`, `doPut`, `doDelete`) handle CSRF and toast notifications automatically
