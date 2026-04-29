# Album Upload Progress Bar — Design

## Problem

When the user creates an album by uploading a ZIP of MP3s, the "Add" step
(`POST /add_album_from_zipfile`) runs a server-side loop that, for every track,
saves a `Song` row and uploads the audio file to S3. For an album of any size
this takes long enough that the current spinner-only modal in
`AlbumCreatePage.tsx` provides no useful feedback — the user can't tell
whether the upload is progressing or stuck.

## Goal

Replace the spinner with a progress bar that updates after every MP3 is
processed. Each tick shows: a percentage bar, the count ("4 of 12"), and the
title of the song just processed.

## Non-goals

- Browser → server upload progress (the time spent transmitting the ZIP
  bytes before processing begins). The "Uploading…" spinner remains as the
  pre-first-event state.
- Per-song retry, partial album recovery, or cancellation from the UI.
- Progress for the scan step (`/scan_album_from_zipfile`); it stays a
  spinner. Scan is metadata-only and fast.
- Cleanup of S3 objects orphaned by a mid-loop failure. This is the
  existing behavior and is not introduced by this change.

## Approach

A single HTTP request whose response body is streamed as
[NDJSON](http://ndjson.org/). The "Add" view becomes a
`StreamingHttpResponse` that yields one JSON line per song processed and a
final `done` or `error` line. The frontend reads the stream incrementally
with `fetch` + `response.body.getReader()`.

This pattern already exists in the codebase: `blob/views.py:1201` (the chat
endpoint) uses `StreamingHttpResponse` to stream text to the client. No new
infrastructure is needed — no Celery, no channel layer, no polling.

### Rejected alternatives

- **Polling with Django cache.** Background thread writes per-song
  progress to cache; client polls `/progress/<job_id>`. Adds a job state
  machine, threads in WSGI workers are fragile, and 500 ms polling
  granularity makes per-song progress feel chunky.
- **WebSockets via django-channels.** No ASGI / channel layer in this
  project today. Massive overkill for one progress bar.

## Data flow

```
Browser                                    Server
  POST /add_album_from_zipfile (multipart)
  ─────────────────────────────────────────────►
                                          scan_zipfile() reads MP3s
                                          transaction.atomic():
                                            for each MP3:
                                              save Song row
                                              upload to S3
  ◄───── {"type":"progress","current":1,"total":12,"title":"…"}\n
  ◄───── {"type":"progress","current":2,"total":12,"title":"…"}\n
  ...
                                          commit
  ◄───── {"type":"done","url":"/music/album/<uuid>"}\n
                                          (mid-loop failure path:)
  ◄───── {"type":"error","detail":"…"}\n   → atomic block rolls back
```

## Wire format

NDJSON. Each line is a single JSON object terminated by `\n`. Four event
types:

| `type` | Fields | Meaning |
|---|---|---|
| `start` | `total` (int) | Scan succeeded; `total` songs will be processed. Always the first event. |
| `progress` | `current` (int, 1-indexed), `total` (int), `title` (str) | One song just finished processing. |
| `done` | `url` (str) | All songs processed and committed. |
| `error` | `detail` (str) | Mid-stream failure. Transaction rolled back. |

`Content-Type: application/x-ndjson`.

The `start` event lets the view drive the generator up to the
post-validation point with a single `next()` call, so empty-zip and other
pre-loop errors can be converted into HTTP 4xx responses without doing any
per-song work and without scanning the zip twice.

## Backend changes

### `bordercore/music/services.py`

`create_album_from_zipfile()` becomes a generator. Signature changes from
`-> UUID` to `-> Iterator[dict[str, Any]]`. Yields one `progress` dict per
loop iteration and one final `done` dict. Exceptions propagate; the service
does not emit `error` events itself.

```python
def create_album_from_zipfile(...) -> Iterator[dict[str, Any]]:
    info = scan_zipfile(zipfile_obj, include_song_data=True)
    if not info["song_info"]:
        raise ValueError("ZIP file contains no MP3 files")

    total = len(info["song_info"])
    yield {"type": "start", "total": total}

    with transaction.atomic():
        artist, _ = Artist.objects.get_or_create(...)
        album = Song.get_or_create_album(...)

        for index, song_info in enumerate(info["song_info"], start=1):
            # existing per-song save + S3 upload
            yield {
                "type": "progress",
                "current": index,
                "total": total,
                "title": song.title,
            }

    yield {"type": "done", "album_uuid": str(album.uuid)}
```

The `done` event carries `album_uuid`, not the full URL — URL construction
stays in the view, where `reverse()` lives.

### `bordercore/music/views.py`

`add_album_from_zipfile` becomes a streaming view.

- **Pre-stream validation** runs first and returns
  `Response({"detail": ...}, status=400)` on failure (no streaming begins).
  This includes:
  - The existing `@validate_post_data("artist", "source")` checks.
  - Missing-zip check.
  - `SongSource.objects.get(id=source_id)` lookup (move out of the
    current generic `except Exception` block).
  - **Drive the service generator to its first event** via
    `first_event = next(create_album_from_zipfile(...))`. If this raises
    `ValueError` (empty / no-MP3 zip) or `StopIteration`, return a 400.
    On success, `first_event` is the `start` event. The scan has run
    once; no per-song work has happened yet.
- Once validation passes, the view builds a wrapper generator that:
  - Yields `first_event` (already consumed) serialized as the first line.
  - Iterates the remaining service-generator events. Each is serialized
    via `json.dumps(event) + "\n"`.
  - Replaces `done.album_uuid` with `done.url` via
    `reverse("music:album_detail", kwargs={"uuid": album_uuid})` before
    serialization.
  - Catches any exception raised by the service generator and yields a
    final `{"type":"error","detail":str(e)}\n` line.
  - On `done`, writes `request.session["song_source"] = ...` (the
    existing post-success side effect).
- Returns `StreamingHttpResponse(wrapper(), content_type="application/x-ndjson")`.

The view stays thin: HTTP plumbing and JSON serialization only. All
business logic remains in the service.

`StreamingHttpResponse` does not go through DRF's `Response` machinery;
this view uses plain Django for the streaming path, matching the precedent
at `blob/views.py:1222`.

## Frontend changes — `AlbumCreatePage.tsx`

Replace the existing `axios.post(addUrl, ...)` in `handleAlbumAdd` with a
`fetch` call that reads the response body as a stream. `axios` stays
imported for the scan call.

New state shape (replaces the boolean `processing` for this flow; the
`processing` boolean stays for input/button `disabled` props and is set
true while `phase !== "idle"`):

```ts
type UploadProgress =
  | { phase: "idle" }
  | { phase: "uploading" }   // request sent, no events yet
  | { phase: "processing"; current: number; total: number; title: string }
  | { phase: "done" };
```

Stream-reading flow:

```ts
const response = await fetch(addUrl, {
  method: "POST",
  body: formData,
  headers: { "X-CSRFToken": csrfToken },
});

if (!response.ok) {
  const { detail } = await response.json();   // pre-stream 400
  setError(detail || "Error creating album.");
  setUploadProgress({ phase: "idle" });
  return;
}

const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    const event = JSON.parse(line);
    if (event.type === "start") {
      setUploadProgress({ phase: "processing", current: 0, total: event.total, title: "" });
    } else if (event.type === "progress") {
      setUploadProgress({ phase: "processing", ...event });
    } else if (event.type === "done") {
      window.location.href = event.url;
      return;
    } else if (event.type === "error") {
      setError(event.detail);
      setUploadProgress({ phase: "idle" });
      return;
    }
  }
}
```

### UI

The existing spinner-only modal at `AlbumCreatePage.tsx:296-310` is
replaced with a modal that renders by phase:

- `phase === "uploading"` — spinner + "Uploading…". Covers the period
  before the first progress event arrives (browser sending bytes, server
  reading the zip).
- `phase === "processing"` — Bootstrap progress bar at
  `current / total * 100`%, with text below: "Uploading 4 of 12: 'Astral
  Weeks'". On the initial `start` event before any song completes,
  `current` is 0 and the title is empty; render as "Uploading 0 of 12"
  (or "Preparing…").

The scan modal in `handleAlbumUpload` is unchanged — still a generic
spinner.

## Error handling

| Case | Behavior |
|---|---|
| Pre-stream validation (missing zip, missing artist/source, empty zip) | `Response({"detail": ...}, status=400)`. Frontend reads JSON via the `!response.ok` branch and shows the existing red alert. No modal in flight. |
| Mid-stream failure (S3 throws, ID3 parse fails, DB error) | Service generator raises. View wrapper catches, yields `{"type":"error","detail":...}\n`. Atomic block exits via exception → DB rolls back. S3 objects already uploaded for earlier tracks are not deleted (existing behavior). HTTP status is **200** because headers were sent before the failure; clients distinguish success vs. failure by event type, not status. |
| Client disconnects mid-stream | Django stops iterating the generator; atomic block exits via `GeneratorExit` → DB rolls back. Same partial-S3 caveat. |
| Concurrent uploads | Out of scope. Session `song_source` is last-write-wins (existing behavior). |
| Cancellation from the UI | Out of scope. Closing the tab works (see client-disconnect row); no in-app cancel button. |

## Testing

### Service tests (`bordercore/music/tests/test_models.py`)

Existing tests call `create_album_from_zipfile()` and assign its return
value. They break with the generator refactor and must be updated:

- `test_create_album_from_zipfile` — drain the generator, assert the
  first event is `{"type": "start", "total": N}`, then progress events
  arrive in order with monotonically increasing `current` (1…N), then
  final event is `{"type": "done", "album_uuid": ...}`. Existing DB and
  S3 assertions kept.
- `test_create_album_from_zipfile_with_changes` — same generator drain,
  plus existing per-track title/note assertions.

Helper to keep assertions clean:

```python
def consume(gen):
    events = list(gen)
    progress = [e for e in events if e["type"] == "progress"]
    final = events[-1]
    return progress, final
```

New service test:

- `test_create_album_from_zipfile_rolls_back_on_failure` — patch
  `Song.upload_song_media_to_s3` to raise on the third song. Assert the
  exception propagates out of the generator, two progress events were
  emitted before the failure, and zero `Song`/`Album` rows remain for
  the user.

### View tests

- `test_add_album_from_zipfile_streams_progress` — POST a fixture zip,
  read `response.streaming_content`, decode each line, parse as JSON,
  assert sequence is one `start` event with `total: N`, then N
  `progress` events with `current` 1…N, then one `done` event with `url`.
- `test_add_album_from_zipfile_streams_error_on_failure` — patch S3 to
  raise; assert the stream ends with an `error` event and HTTP status is
  200 (headers committed before failure).
- Existing pre-stream validation tests (missing zip, etc.) continue to
  return 400 and are unchanged.

### Frontend tests

No Jest/Vitest setup confirmed for this page. To be verified before plan
execution; if no harness exists, frontend verification is manual: upload a
real zip, watch the bar, simulate a failing song by killing the dev S3
endpoint or network mid-upload. No new test infra is introduced for this
feature.

## Files touched

- `bordercore/music/services.py` — `create_album_from_zipfile` becomes a
  generator.
- `bordercore/music/views.py` — `add_album_from_zipfile` becomes a
  streaming view; pre-stream validation extended to reject empty zips.
- `bordercore/music/tests/test_models.py` — update two existing tests,
  add one rollback test.
- `bordercore/music/tests/` (new view tests) — file path TBD during plan,
  consistent with existing test layout.
- `bordercore/front-end/react/music/AlbumCreatePage.tsx` — switch the
  Add call to `fetch` + stream reader, replace the spinner modal with the
  progress modal, add `UploadProgress` state.
