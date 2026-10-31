# Quantified Self

Bordercore's `/quantified-self/` app records weight, blood pressure, resting heart rate, HRV, and timestamped
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
Automatic switch presses create awakenings only from **22:00 inclusive to 09:00
exclusive in America/New_York**, with daylight saving handled by the timezone.
The filter uses the supplied occurrence timestamp, not the time a delayed request
arrives. Valid daytime presses return HTTP 200 with
`{"status": "ignored", "reason": "outside_sleep_window"}`; the listener should
acknowledge them without retrying. They create no observation, source, or night and
do not change night completeness. Manual entries and CSV imports remain unrestricted.

Every valid delivery, including daytime tests and retries, is logged through
`bordercore.quantified_self.views`: receipt first, then `recorded`, `duplicate`, or
`ignored`. Logs include the account ID, source, external event ID, and New York
occurrence timestamp. A receipt is retained even if the subsequent database write
fails. Development logs go to the server console; production logs go to
`/var/log/django/bordercore.log` under the existing rotation policy. Daytime test
presses are diagnostic log entries, not awakening rows.

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

## Apple Health ZIP

Select **Apple Health ZIP** in Imports and upload the iPhone's Export All Health
Data archive. Preview shows totals for weight, blood pressure, resting heart rate,
HRV (SDNN), and sleep intervals, with new/existing counts,
sources, date ranges, pairing warnings, and up to 50 recent readings. The preview
shows counts for each tracker/source pair, with opt-in checkboxes and a selected
new/existing total. For example, choose only Google Health for sleep while choosing
other sources for weight. Confirm saves only the selected pairs atomically.
Partial selections receive their own repeat-safe import batch; omitted sources
remain available on a later upload. The commit API accepts `selection` as a list
of `{ "kind": "sleep", "source": "Apple Health · Google Health" }` objects.
Empty, null, or unknown selections are rejected. Omitting `selection` retains the
legacy all-source API behavior. Pulse, workouts, and clinical data are not imported.
Migration `0002` adds resting-heart-rate (bpm) and HRV SDNN (ms) tables.
Apply it before serving the updated dashboard. Re-uploading an older export adds
the newly supported metrics while skipping previously imported weight and pressure.

Migration `0003` adds sleep sessions and stage intervals. Apply it before serving
the sleep dashboard. Sleep is available on the overview and its own detail page,
with duration, a seven-calendar-day average, stage intervals, and switch-press
markers. Select a source to inspect its estimates; different sources are never
added together. Missing nights and in-bed-only records do not imply sleep duration.

Apple Health sleep imports `HKCategoryTypeIdentifierSleepAnalysis`: awake, core
(light), deep, REM, unspecified asleep, and in-bed intervals. Identity includes
source, UTC start/end, and stage, so reimporting is safe. Overlapping intervals
within a source are unioned; awake takes precedence, detailed stages override
unspecified asleep, and conflicting detailed stages become unspecified asleep.
In-bed coverage is reported independently and never added to time asleep.

Apple Health copies from `Google Health` are also checked against the same user's
direct `Google Health` import. Identical start/end/stage intervals are skipped;
in-bed intervals are skipped when their bounds exactly match a Google sleep
session. This check includes excluded records, runs again at commit, and does not
merge sources or treat mere overlap as a duplicate. Other sources remain independent.

The one-time Google Health data load retains session totals and stage provenance.
Overlapping Google session estimates prefer `sleep_session_v2` over v1; other
ties prefer the source's update time. Nonoverlapping sessions, including naps,
remain included. Reported sleep duration can differ from summed stage durations.
There is no Google Takeout upload workflow. Sleep morning dates use the same
New York noon-to-noon window as awakenings; elapsed durations use UTC, including
across daylight-saving changes. Device-detected awake stages remain separate from
button presses and do not mark an awakening night complete.

The importer streams only `apple_health_export/export.xml` (or root `export.xml`)
without extracting the archive. Limits: 512 MB ZIP, 4 GB XML, 10,000 archive entries,
1,000,000 relevant XML records, and 100,000 distinct readings. Parsing happens before
acquiring the account write lock. Only selected measurements are saved in the
preview batch; the original ZIP and unrelated health data are not retained.

Production Gunicorn workers allow 300 seconds per request in `bin/gunicorn_start`.
Large exports can exceed Gunicorn's default 30-second timeout while parsing;
progress polling does not keep the busy synchronous worker alive. Activating a
change to this startup option requires a full Gunicorn restart, not the deployment
hook's HUP reload. The longer timeout applies to all requests on these workers.

The import panel reports browser upload bytes, XML scan bytes and discovered
per-tracker counts, duplicate checking, validation, and batched writes. The
browser polls `imports/progress/<uuid>/` while the original preview/commit request
runs. Progress is scoped to the authenticated account, expires after one hour,
and contains only stages/counts, not measurements. It uses the configured Django
cache (shared file cache across production workers, local-memory cache for the
single development process). Multiple app hosts must use a shared cache backend.
Cache failures only disable live progress; the original request remains authoritative.
Saving remains atomic, and completion is published only after the transaction exits.

Sources are named `Apple Health · <sourceName>`. Reading identities hash the tracker,
source, UTC start timestamp, and measurement values, independently of ZIP filename,
record ordering, creation dates, and optional Apple metadata. Weight identity uses
kilograms to six decimal places; stored lb/kg values round to three decimal places
(grams convert to kg). Blood-pressure components pair only when source, start, and
end timestamps match and each component has one distinct value. Repeated top-level
and correlation-nested records collapse; incomplete or ambiguous groups are skipped
and counted in the preview. Pulse matching is deferred.

Resting heart rate imports `HKQuantityTypeIdentifierRestingHeartRate` in
`count/min`, displayed as bpm. HRV imports only
`HKQuantityTypeIdentifierHeartRateVariabilitySDNN` in ms. Both retain six decimal
places and use the same repeat-safe source/timestamp/value identities. Ordinary
heart-rate samples and other HRV definitions are not imported. Detail charts show
daily means and seven-calendar-day trends, averaging only recorded daily means
so days with many samples do not dominate. Missing days remain missing; excluded
readings do not affect statistics. Detail tables paginate through the entire range.

Explicit UTC offsets determine the instant. Display dates/times use `HKTimeZone`
when valid, otherwise America/New_York. This avoids interpreting historical export
offsets as the current daylight-saving offset. Reimport never overwrites website
edits or exclusions. Concurrent commits serialize on the account and recheck IDs;
database uniqueness enforces the source/ID identity. Different sources or changed
measurement values are distinct observations; this is not fuzzy matching against
manually entered readings. Replaying an already committed batch returns its original
result. Invalid relevant records reject the preview without importing any readings.

## Validation

Run `pytest bordercore/quantified_self/tests` against an isolated PostgreSQL test
database, with the repository's normal Elasticsearch mocking enabled. Never assume
`config.settings.dev` selects a local database: it inherits the configured database
host. In `bordercore/`, run `npm test -- front-end/react/quantified-self`,
`npm run typecheck`, and the production Vite build. Browser smoke tests should use
sandbox with synthetic data and the intended code revision.
