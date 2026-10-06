![Bordercore Logo](/bordercore/static/img/bordercore-title.png)

[![Backend](https://github.com/bordercore/bordercore-nexus/actions/workflows/backend.yml/badge.svg)](https://github.com/bordercore/bordercore-nexus/actions/workflows/backend.yml)
[![Frontend](https://github.com/bordercore/bordercore-nexus/actions/workflows/frontend.yml/badge.svg)](https://github.com/bordercore/bordercore-nexus/actions/workflows/frontend.yml)

---

*Bordercore* is a "Second Brain" personal knowledge base platform, designed to organize your digital life. Imagine a digital sanctuary where all your vital information converges -- notes whispering insights, PDFs sharing knowledge, bookmarks guiding your web exploration, flashcards sparking memory, and todos orchestrating your day.

## Features

Bordercore supports a wide range of personal data types, all integrated into a single searchable interface:

- **Notes & Documents**: Create and manage rich text notes and uploaded documents (PDFs, images, etc.).
- **Bookmarks**: Save and organize web links with automatic favicon and thumbnail generation.
- **Todo Lists**: Track tasks with priorities, tags, and reminders.
- **Flashcards (Drill)**: A spaced-repetition system for learning and memory.
- **Music Library**: Manage your music collection, playlists, and listening history.
- **Fitness Tracking**: Log workouts, exercises, and track progress over time.
- **RSS Feeds**: Subscribe to and read your favorite web feeds.
- **Quotes**: Collect and tag inspiring quotes.
- **Collections**: Group any object in the system into curated collections.
- **Tagging**: Virtually every object in the system can be tagged for easy organization.
- **Semantic Search**: Search by keyword, tag, or embedding (semantic search) powered by Elasticsearch and OpenAI/local embeddings.

## Architecture

Bordercore is built with a modern, scalable tech stack:

- **Backend**: [Django](https://www.djangoproject.com/) (Python) provides the core logic and REST API.
- **Frontend**: [React](https://reactjs.org/) with [Vite](https://vitejs.dev/) for a fast, responsive user interface.
- **Database**: [PostgreSQL](https://www.postgresql.org/) for structured data.
- **Search Engine**: [Elasticsearch](https://www.elastic.co/) for full-text and vector-based semantic search.
- **Asynchronous Tasks**: [AWS Lambda](https://aws.amazon.com/lambda/) handles background tasks like thumbnail generation, embedding creation, and RSS feed updates.
- **Storage**: [AWS S3](https://aws.amazon.com/s3/) for hosting user-uploaded blobs and media.

## Development

To run the development environment:

1.  **Backend**:
    ```bash
    uv sync --group dev
    python manage.py runserver
    ```

2.  **Frontend**:
    ```bash
    cd bordercore/front-end
    npm install
    npm run dev
    ```

## Testing

Bordercore uses `pytest` for its testing suite, orchestrated by a custom test runner.

### Prerequisites

Ensure the following environment variables are set:

```bash
export BORDERCORE_HOME=$INSTALL_DIR/bordercore
export PYTHONPATH=$INSTALL_DIR:$INSTALL_DIR/bordercore
export DJANGO_SETTINGS_MODULE=config.settings.prod # Or dev
```

### Running Tests

You can run tests using the `Makefile` or directly via the `test_runner.py` script.

**Using Make:**

```bash
# Run unit tests (Elasticsearch is mocked by default)
make test_unit

# Run functional tests (Selenium-based)
make test_functional

# Run data quality tests
make test_data

# Run coverage report
make test_coverage
```

**Using the Test Runner:**

The `bin/test_runner.py` script provides more control and records metrics to the database.

```bash
python3 bin/test_runner.py --test [unit|coverage|functional|wumpus|data] [--verbose]
```

If you need to reset the test index, you can use:
```bash
make reset_elasticsearch
```

### Mocking

By default, the test runner sets `MOCK_ELASTICSEARCH=1` for unit and functional tests to avoid external dependencies. If you want to test with a real Elasticsearch instance, ensure `MOCK_ELASTICSEARCH` is not set to `1` in your environment.

### Lumen interactive lessons

Lumen is integrated at `/lumen/`. **Explore with Lumen** on a drill question
opens its latest lesson (or the creation form) in a separate tab. Generation
uses the saved question and answer, independently of temporary drill rephrasing.
Every regeneration preserves earlier versions and their source snapshots.

Each new lesson includes a structured **Accuracy check** card. If the model identifies
a factual issue, the card previews the complete corrected question and answer and
provides **Correct original question and answer**. Clicking it updates only those
two drill fields and the modification timestamp, and refreshes the search index.
The original lesson snapshot, versions, tags, and review schedule are preserved.
A newer edit to the drill blocks the correction; regenerate before applying another
proposal. Repeated clicks are safe. This is a model assessment, not independent
fact-checking; uncertain assessments do not offer a correction.

Older lessons offer **Check accuracy**, which queues a paid source-only assessment
using the selected provider/model without regenerating their HTML. It prepares a
proposal; applying it always requires a separate click. Assessments and correction
buttons are rendered by the trusted app, outside the generated HTML sandbox.


**Preferences → Lumen → Lumen lesson theme** selects Midnight Scholar, Paper &
Ink, Forest Study, or Neon Circuit independently of the Bordercore application
theme. The choice applies to saved versions and HTML downloads without rewriting
archives or calling a model. Open readers refresh the theme on focus or within
five seconds. Provider/model preferences are set on the Lumen page. Credentials
come only from the server environment loaded by Django: `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, and `OPENROUTER_API_KEY` (or `OPENROUTER_KEY`). No Bordercore
API token is needed.

Deployment/setup, against the **intended database and settings module**:

1. Apply migrations using `python manage.py migrate` and build assets using
   `NODE_ENV=production npm run vite:build` from `bordercore/`.
2. Set `LUMEN_GENERATION_ENABLED=true` in both the web and worker environments.
   It defaults to false; the library remains readable while generation is disabled.
3. Run `python manage.py run_lumen_worker` as a separate supervised process.
   `config/supervisor/lumen.conf` is a deployment template; align paths, credentials,
   and environment with the web service. `--once` handles at most one queued job.
   For the existing EC2 deployment, run `make lumen-install` from your local checkout
   after deploying the code and applying migrations. This installs the deployed
   Supervisor configuration and starts the worker, with automatic startup on boot
   and restart after failure. Re-running it leaves an already-running worker alone
   unless its configuration changed. Use `make lumen-status` to check it and
   `make lumen-restart` to load worker code changes after later deployments.
   These commands only manage the worker; set `LUMEN_GENERATION_ENABLED=true` in
   `/var/www/django/bordercore/config/settings/secrets.env` and reload the web
   processes separately to enable generation in the UI. Worker logs are at
   `/var/log/django/lumen.log` on EC2.
4. Import the old dashboard library explicitly, first with a dry run:

   ```bash
   python manage.py import_lumen_library ~/drill-lessons --user <username> --dry-run
   python manage.py import_lumen_library ~/drill-lessons --user <username>
   ```

The importer reads SQLite in read-only mode, preserves IDs/timestamps/HTML, checks
metadata and ownership, skips identical versions, and aborts atomically on conflicts.
Missing questions retain their archived sources. It imports provider/model/theme
preferences only when that user has no Lumen preferences yet. It never changes the
source library or imports interrupted dashboard jobs.

PostgreSQL stores both HTML and metadata, so normal database backups cover the
library. The queue is limited to four active/queued jobs, with one active job per
user/question. Run one worker initially. Job claims are safe across worker processes;
provider calls happen outside database transactions. A 15-minute lease exceeds the
10-minute provider read timeout. Expired jobs fail without automatically repeating a
potentially billed call. Explicit regeneration retries with a new job. A stopped
worker leaves queued jobs for its replacement. Supervisor allows in-flight requests
to finish during graceful shutdown.

Generated HTML is untrusted: authenticated views serve it with restrictive CSP and
an `allow-scripts` iframe sandbox, without same-origin privileges. Only the lesson
endpoint permits same-origin framing. Downloads retain a restrictive CSP meta tag;
model explanations and scripts may still contain errors. Legacy canvas pixels may
not adapt to new themes; this matches the original dashboard's limitation.

Lessons embed MathJax 3 (also used by drill pages) with SVG output, so equations work
offline without fetching scripts or fonts or weakening the sandbox. New lessons
use LaTeX delimiters `\(...\)` and `\[...\]`; `$$...$$` also works. At display time,
recognizable older `.formula`/`.equation` blocks and mathematical inline code use
MathJax's AsciiMath parser. Ordinary prose and programming examples are not inferred
as math. Ambiguous legacy notation may still need regeneration. Formulas are typeset
on page load; interactive readouts should use native HTML. Saved HTML is unchanged.
To rebuild the committed renderer after changes, run `npm run build:lumen-math` from
`bordercore/`. Its MathJax license is included in `lumen/vendor/`.

Tests use synthetic provider responses. With local PostgreSQL configured, run:

```bash
python -m pytest bordercore/lumen/tests/test_lumen.py
python -m pytest bordercore/lumen/tests/test_browser.py  # Firefox/geckodriver + built assets
```
