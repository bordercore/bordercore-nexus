![Bordercore Logo](/bordercore/static/img/bordercore-title.png)

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
    pip install -r requirements/dev.txt
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
