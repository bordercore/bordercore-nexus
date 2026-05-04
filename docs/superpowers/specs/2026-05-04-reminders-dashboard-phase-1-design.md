# Reminders Dashboard — Phase 1 Design

## Background

The current `/reminder/` page (React, `front-end/react/reminder/RemindersPage.tsx` + `RemindersTable.tsx`) is a paginated, row-by-row list. Edits go through a separate full-page `<uuid>/edit/` route; deletes go through a `<uuid>/delete/` confirmation page. The design hand-off in `design_handoff_reminders_dashboard/README.md` proposes replacing this with a "cyberpunk dashboard" — a grouped list paired with a 5-card right rail.

The hand-off README mistakenly describes the stack as "Vue 3 / Pinia / SCSS"; the actual codebase is **React + TypeScript** with TanStack Table, FontAwesome, and SCSS using the existing oklch token system (`_theme-cyberpunk.scss`, `_theme-purple.scss`, `_theme-light.scss`). This spec lifts the visual specification into the React + token system that already exists.

The full hand-off has been split into three phases. **Phase 1 (this spec)** is everything that's purely frontend and uses today's reminder data. Phases 2 and 3 cover the fortnight heatmap, streak panel, `fire now` / `snooze 1h` actions, and acknowledgment-tracking data model — each requires its own design conversation about new endpoints and data shapes.

## Phase 1 Scope

**In scope:**

- Replace the paginated table with a `1fr | 320px` grid: grouped list on the left, a right rail with 3 cards.
- Group rows by urgency: `⌁ firing soon` → `today & tomorrow` → `this week` → `later` → `inactive`.
- Cyan border + cyan glow on the single imminent row.
- Weekly schedules render an inline 7-day "lit chip" strip (M T W T F S S).
- Right rail cards: **next-trigger** (countdown), **up next** (queue of 3), **stats** (3-tile strip).
- Page header with reminder count + "+ new reminder" primary button.
- Toolbar: search input + filter pills (`all` / `active` / `firing today`).
- 1 Hz client-side countdown ticker driving the next-trigger card.
- Edit, new, and delete actions use the existing `refined-modal` pattern (mirrors `EditTodoModal.tsx`, `NewTodoModal.tsx`, and the `BlobUpdatePage.tsx` delete confirm).

**Explicitly out of scope (phase 2 or 3):**

- Fortnight heatmap card (rail card #3 in README) — needs new endpoint and per-fire history we don't store.
- Streak panel (rail card #4 in README) — needs an acknowledgment-tracking data model that doesn't exist.
- `snooze 1h` and `fire now` buttons on the next-trigger card — no endpoints exist; only the `open` button is rendered.
- "Fired · 30d" stat — no per-fire history; replaced with "next 7d" (see below).
- ⌘K / ⌘N keyboard shortcuts and the keycap UI hint.
- Topbar (`.rm-topbar`) and outer 240px sidebar (`.rm-sidebar`) from the README — these are app-shell concerns; the existing app shell is left alone.
- Tags-based search — reminders have no tag field. Search is name + note only.
- Sort dropdown — within groups, sort is implicitly `next_trigger ASC`; the control is dropped.
- Animated glows, drawer pattern, ICS import.

## Decisions

### Imminence and grouping thresholds

Computed from `now` (recomputed every second) and each active reminder's `next_trigger_at_unix`:

| Group label | Membership |
|---|---|
| `⌁ firing soon` (purple) | `is_active && next_trigger_at_unix - now ≤ 60 min` |
| `today & tomorrow` | `is_active && next_trigger_at_unix - now ≤ 48 h`, not in firing-soon |
| `this week` | `is_active && next_trigger_at_unix - now ≤ 7 d`, not in earlier groups |
| `later` | `is_active && next_trigger_at_unix - now > 7 d` (or `next_trigger_at` null) |
| `inactive` | `!is_active` (rendered at 0.55 opacity per README) |

Groups with zero rows are not rendered (no empty group headers).

The single **imminent row** that gets the cyan border + glow (`.rm-row.imminent`) is the head of `firing soon`. If `firing soon` is empty, no row gets the imminent treatment (the next-trigger card still shows the next active reminder).

The README's three status pip variants map as follows:

| Pill | Color / pulse | Applies to |
|---|---|---|
| `imminent` | purple, fast pulse (1.4 s) | every row in the `firing soon` group |
| `active` | cyan, slow pulse (2.4 s) | every other active row |
| `inactive` | grey, no pulse | inactive rows |

### Filter pill semantics

- `all` — every reminder, including inactive.
- `active` — `is_active === true`.
- `firing today` — `is_active && next_trigger_at` falls within the local-tz calendar day of `now`.

Pill counts in the labels (`all 11` / `active 10` / `firing today 2`) are recomputed from the unfiltered list and update live. Search composes on top of the active pill filter (substring match on `name` + `note`, case-insensitive).

### Stats card content

The README's third stat (`38 fired · 30d`) requires per-fire history that the backend doesn't store. Phase 1 ships a different third stat that is derivable from current data:

| Stat | Value | Color (per README weight) |
|---|---|---|
| `active` | count of `is_active` | cyan |
| `today` | count of `is_active` with `next_trigger_at` in today | purple |
| `next 7d` | count of `is_active` with `next_trigger_at` within 7 days from now | default |

When the heatmap data lands in phase 2, `next 7d` swaps to `fired · 30d`.

### Modal patterns

Three new modal components, each following the existing `refined-modal` pattern (the `refined-modal-scrim` + `refined-modal` + `refined-btn` SCSS classes already in use by `EditTodoModal.tsx` and `BlobUpdatePage.tsx`'s delete confirm):

- **`NewReminderModal.tsx`** — opened by the page-header "+ new reminder" button. Mirrors `NewTodoModal.tsx`. POSTs to existing `reminder:create` endpoint; on success, closes and refetches the list.
- **`EditReminderModal.tsx`** — opened by row ✎. Loads form data via existing `reminder:form-ajax` (`/ajax/form/<uuid>/`); POSTs to existing `reminder:update` (`<uuid>/edit/`). On success, closes and refetches.
- **`DeleteReminderModal.tsx`** — opened by row ✕. Confirms by name. On confirm, POSTs to existing `reminder:delete` (`<uuid>/delete/`); on success, closes and refetches.

The existing full-page `<uuid>/edit/` and `<uuid>/delete/` routes remain reachable via direct URL; they will be removed in a follow-up cleanup once the modals are proven. No backend changes needed for any of these flows — the existing endpoints already accept `X-Requested-With: XMLHttpRequest` and return JSON.

The README's specific delete-modal styling (380 px wide, danger-pink border, mono name pill) is **not** lifted verbatim — we use the codebase's established refined-modal look so the dashboard's modals match the rest of the app.

### Token mapping

The README pins specific colors (`--bc-accent: #b36bff` purple, `--bc-accent-4: #4cc2ff` cyan) and asks us to match the visual weight while preferring the app's tokens. Mapping:

| README token | Phase 1 mapping |
|---|---|
| `--bc-accent` (purple, primary) | `--accent` (theme-driven; on cyberpunk theme this is already a magenta/purple) |
| `--bc-bg-2` / `--bc-bg-3` / `--bc-bg-4` | existing `--bg-2` / `--bg-3` / `--bg-4` |
| `--bc-fg-1..4` | existing `--fg-0..4` (the README's `--bc-fg-1` is "primary text" → our `--fg-0`) |
| `--bc-border-1` / `--bc-border-2` | existing `--line-soft` / `--line` |
| `--bc-accent-4` (cyan, "next / imminent" highlight) | **new page-local CSS var `--rm-cyan`** defined in `_reminders-dashboard.scss`. Theme-independent: `oklch(78% 0.15 230deg)` (a cobalt cyan that reads on every existing theme). |
| Glow shadows | reproduced via the existing `--accent-glow` for purple glows; cyan glows use a page-local `--rm-cyan-glow` companion var. |

The two-color (purple + cyan) treatment is intentional design, so cyan getting its own page-local token is correct — it's a page accent, not a theme-wide one.

### Countdown ticker

A `now: Date` state in `RemindersDashboard.tsx` is updated by `setInterval(..., 1000)`. The interval is paused via `document.visibilitychange` when the tab is hidden (mirroring the existing pattern in `RemindersPage.tsx`'s 10-minute refresh) and re-started on visible. All derived state (group buckets, imminent id, up-next list, countdown numerals, filter pill counts) recomputes from `(reminders, now)` via memoized selectors in `grouping.ts`.

The countdown shows `HH MM SS` — the README's giant 32 px mono numerals with the cyan text-shadow glow.

### Pagination

Dropped. `ReminderListAjaxView` returns the full list ordered by `next_trigger_at ASC, -created`. Reminder lists are not expected to exceed a few hundred rows per user; if this assumption breaks we add a "show all / show top 50" affordance in a follow-up — not now.

## Architecture

### File layout

```
front-end/react/reminder/
├── RemindersPage.tsx           (kept — orchestrator: fetch + modal state)
├── RemindersTable.tsx          (DELETED)
├── grouping.ts                 (pure derivations + tested in grouping.test.ts)
├── grouping.test.ts            (vitest, no DOM)
├── types.ts                    (Reminder type — extracted from RemindersTable)
├── dashboard/
│   ├── RemindersDashboard.tsx  (1fr | 320px grid; owns now-ticker)
│   ├── PageHead.tsx
│   ├── Toolbar.tsx
│   ├── ReminderList.tsx
│   ├── ReminderGroup.tsx
│   ├── ReminderRow.tsx
│   ├── WeekChips.tsx
│   ├── StatusBadge.tsx
│   ├── NextTriggerCard.tsx
│   ├── UpNextCard.tsx
│   └── StatsCard.tsx
└── modals/
    ├── NewReminderModal.tsx
    ├── EditReminderModal.tsx
    └── DeleteReminderModal.tsx
```

### SCSS

```
static/scss/pages/_reminders-dashboard.scss   (NEW — all dashboard styles, scoped under .rm-dashboard)
static/scss/components/_reminders-table.scss  (DELETED — no longer used)
static/scss/pages/_reminders.scss             (KEPT — form input styling for full-page edit; survives until that route is retired)
static/scss/bordercore.scss                   (UPDATED — swap @use line)
```

All new SCSS uses existing oklch tokens; only `--rm-cyan` and `--rm-cyan-glow` are new and defined locally in `_reminders-dashboard.scss` under `.rm-dashboard { ... }`.

### Component responsibilities

- **`RemindersPage.tsx`** — fetches reminders (existing `loadReminders`), holds `reminders`, `loading`, and modal state (`editingUuid`, `deleting`, `creating`). Renders `<RemindersDashboard>` with reminders + modal callbacks. Hosts the three modal components conditionally. The 10-minute refresh interval and `visibilitychange` handler stay.
- **`RemindersDashboard.tsx`** — owns `now` (1 s ticker), `query` (search), `filter` ("all" | "active" | "today"). Computes derived state via `grouping.ts`. Renders `PageHead`, `Toolbar`, `ReminderList`, and the three rail cards.
- **`grouping.ts`** — pure functions: `bucketReminders(reminders, now)`, `deriveImminent(reminders, now)`, `deriveUpNext(reminders, now, excludeUuid)`, `deriveStats(reminders, now)`, `applyFilter(reminders, filter, query, now)`, `countByFilter(reminders, now)`. All deterministic, all unit-tested.
- **`ReminderRow.tsx`** — renders a single row. Receives `reminder`, `isImminent`, `now`, plus `onEdit(uuid)` and `onDelete(uuid)` callbacks. The hover-only ✎/✕ icons are CSS-driven (no JS state). For weekly schedules, embeds `<WeekChips days={reminder.days_of_week}>`.
- **`NextTriggerCard.tsx`** — receives `reminder | null` + `now`. Renders countdown numerals via `Math.floor((next_trigger_at_unix * 1000 - now.getTime()) / 1000)`. Progress bar % is `1 - remaining / period`, where period is one schedule cycle (24h for daily, 7d for weekly with single day, etc.) — kept simple: 24h cycle for phase 1.
- **`UpNextCard.tsx`** — receives the array from `deriveUpNext`. Renders 3 rows or "no upcoming reminders" placeholder.
- **`StatsCard.tsx`** — receives `{ active, today, next7d }` from `deriveStats`.

### Backend

`reminder/views.py` `ReminderListAjaxView`:

- Remove `paginate_by` and the paginator. Return all of the user's reminders ordered by `next_trigger_at ASC, -created`.
- Add `days_of_week: list[int]` and `days_of_month: list[int]` to each reminder's serialized dict.
- Drop the `pagination` key from the response.

Frontend (`RemindersPage.tsx`) is updated to consume the new shape (no `pagination`, plus the new fields in the `Reminder` type).

`reminder/tests/test_views.py` (or wherever the list-ajax test lives) is updated to match the new response shape.

No URL changes, no model changes, no migrations.

## Testing

- **Unit tests** (`grouping.test.ts`, vitest) for `bucketReminders`, `deriveImminent`, `deriveUpNext`, `deriveStats`, `applyFilter` — full coverage of edge cases (empty list, all inactive, exactly-on-threshold, null `next_trigger_at`, etc.).
- **Backend** — update existing `ReminderListAjaxView` tests for the new (un-paginated) shape and the two added fields.
- **Visual** — start the dev server and verify the dashboard in a browser before claiming the task done; check the imminent row glow, countdown ticking, group rendering, modal flows for new / edit / delete, filter pills, and search.

## Migration notes

- Removing `RemindersTable.tsx` and `_reminders-table.scss` cleanly means the dev `vite` build picks up the new SCSS via `bordercore.scss`. No build config changes expected.
- The full-page `<uuid>/edit/` and `<uuid>/delete/` routes remain wired and reachable; their views stay untouched. They are removed in a later commit once the modal flows are proven.
