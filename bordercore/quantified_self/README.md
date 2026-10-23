# Quantified Self

Bordercore's `/quantified-self/` app records weight, blood pressure, and timestamped
sleep awakenings. It includes a dashboard, tracker detail views, editable history,
night completeness review, CSV preview/import, and CSV export. The Wumpus listener
is intentionally not included.

## Setup

Use the intended environment's Django settings/database. Apply the migration with
`python manage.py migrate quantified_self` and build frontend assets with
`NODE_ENV=production npm run vite:build` from `bordercore/`. Deploy both code and
assets together. No scheduler, new Python dependency, or new frontend package is
required. All records are scoped to the signed-in account.

## Measurement rules

- Weight preserves entered lb/kg values and stores normalized kilograms using
  decimal arithmetic. Charts use the selected display unit.
- Blood pressure stores systolic/diastolic together, with optional pulse. Repeated
  measurements on the same day or at the same time remain separate records.
- A measurement date is required; a time is optional. Missing times are not
  converted to midnight. Known times have an IANA timezone and resolved UTC time.
- Ambiguous daylight-saving times require an explicit `utc_offset`; nonexistent
  local times are rejected. Dates before 1900 and future observations are rejected.
- Chart points show daily means, and selecting a day shows individual readings.
  The seven-day trend averages the daily means that exist in that calendar window,
  including up to six days before the selected chart range. Missing days never
  contribute zero. BP summary averages are per reading and show both reading and
  day counts.
- Weight display preference is remembered in this browser and included in the
  bookmarkable filter URL. Latest-reading cards are all-time; charts use the range.

## Nights

A night is a fixed noon-to-noon window in `America/New_York`, labeled by its morning
date. For example, noon October 20 through just before noon October 21 is the
night ending October 21. This is a reporting window, not a sleep-duration estimate.
UTC timestamps distinguish the two occurrences of a local clock time at fall-back.

Unreviewed empty nights are missing data, not zero. Mark a night complete to confirm
its count, including zero. Incomplete and unreviewed nights do not enter the nightly
average, but their recorded events remain visible in charts. New/edited/excluded
events reopen affected nights. Night-review writes require the displayed revision
and reject stale or partially conflicting bulk reviews atomically.

Records can be excluded and restored through Edit. They are retained in history and
exports, with their source identity, so replay cannot resurrect an accidental press.

## Future listener API

`POST /api/quantified-self/awakenings/` uses Bordercore's existing DRF authentication
(`Authorization: Token <token>` for automation; session authentication requires CSRF).
Example JSON:

```json
{
  "source": "Wumpus bedroom button",
  "external_id": "a-stable-unique-event-id",
  "timestamp": "2026-10-21T02:15:00-04:00",
  "note": ""
}
```

All three identity/time fields are required. The authenticated account owns the
record. A new event returns 201. Replaying the same source and external ID returns
200 and the existing record without overwriting website corrections or exclusions.
IDs must identify occurrences, not device names or rounded timestamps. Distinct IDs
at nearby times remain distinct events. Capture and durable retry are the future
listener's responsibility. There is no listener status/heartbeat UI until it exists.

## CSV

Download the tracker-specific template from Imports. Files must be UTF-8, at most
2 MB and 5,000 records. Date format is `YYYY-MM-DD`; awakening timestamps need an
explicit UTC offset. Optional `source` values in rows override the import-level
source name, allowing exports to retain mixed provenance. Optional external IDs
are scoped to source and tracker.

Preview creates only import metadata, not readings. Confirmation revalidates and
commits atomically. Existing IDs never overwrite records; equal measurements without
matching IDs are flagged as possible duplicates and skipped unless explicitly
selected. Replaying a committed file returns its prior result. A changed filename
does not bypass content-based detection. Imports do not mark nights complete.

Exports include excluded records, original units, known-time precision, timezone,
source, and external ID. `csv_format=bordercore-v1` marks exported strings escaped
with a leading apostrophe to prevent spreadsheet formula execution. Reimport removes
that escape exactly, preserving notes, IDs, source names, and offsets. Do not add the
format marker to third-party files unless using the same encoding.

## Validation

Run `pytest bordercore/quantified_self/tests` against an isolated PostgreSQL test
database, with the repository's normal Elasticsearch mocking enabled. Never assume
`config.settings.dev` selects a local database: it inherits the configured database
host. In `bordercore/`, run `npm test -- front-end/react/quantified-self`,
`npm run typecheck`, and the production Vite build. Browser smoke tests should use
sandbox with synthetic data and the intended code revision.
