# Elasticsearch 7.16 → 8.x Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Bordercore from Elasticsearch 7.16.2 to 8.x on a new same-size EC2 instance, port the codebase to the es8 Python client, and move `embeddings_vector` to an indexed `dense_vector` with native kNN — laying the foundation for the Notes RAG project.

**Architecture:** Stand up a fresh `t3a.medium` Ubuntu 24.04 box running ES 8.17.x (apt + systemd, security off / SG-only). Migrate the Python client (`elasticsearch`/`elasticsearch-dsl` 7.x → 8.x) — the es8 transport drops `RequestsHttpConnection`, so all 5 connection sites are rewritten. Convert the three Painless `script_score`/`cosineSimilarity` sites to native `knn`. Build the new index by fresh reindex from the Django DB / S3 source of truth, validate, then cut over `ELASTICSEARCH_ENDPOINT` for the app + 4 Lambdas. Old ES7 stays untouched as a rollback.

**Tech Stack:** Elasticsearch 8.17.x, `elasticsearch`/`elasticsearch-dsl` 8.x Python clients, Django, pytest (`@pytest.mark.data_quality` real-cluster tests), AWS EC2/EBS/Lambda, ingest-attachment plugin.

---

## Conventions for this plan

- **Repo root:** `/home/jerrell/dev/django/bordercore`
- **Run management commands / pytest** through the project venv. Wrap any command whose pre-commit hook runs `uv run mypy` in `script -qc '<cmd>' /dev/null` (snap-confine breaks `uv run` when stdout is piped).
- **The new ES8 host** is referred to as `$ES8_HOST` (e.g. `http://10.x.x.x:9200`). The current ES7 host as `$ES7_HOST`.
- **Two ES8 endpoints are used during development:** a **local Docker ES8** for fast TDD of code changes (Phase 2–3), and the **new EC2 ES8** for the real reindex/cutover (Phase 4). Both run the same 8.17.x and the same mappings.
- Unit tests mock ES (`bordercore/conftest.py:152-178`), so they will **not** catch client-API breaks. The real verification for client/kNN work is the **`@pytest.mark.data_quality`** suite pointed at a live ES8. Run it with `ELASTICSEARCH_ENDPOINT` set to the ES8 endpoint.

---

## Phase 0: Pre-flight & local ES8 for TDD

### Task 0.1: Stand up a local Docker ES8 for development

**Files:**
- Create: `config/elasticsearch/docker-compose.es8.yml`

- [ ] **Step 1: Write the compose file**

```yaml
# config/elasticsearch/docker-compose.es8.yml
# Local ES8 for development/TDD only. Mirrors prod: security off, single node.
services:
  es8:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.17.1
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - xpack.security.http.ssl.enabled=false
      - ES_JAVA_OPTS=-Xms1g -Xmx1g
      - http.max_content_length=250mb
      # Allow _reindex to pull from the remote ES7 host (set ES7 host:port).
      - reindex.remote.whitelist=${ES7_REINDEX_WHITELIST:-es7.example:9200}
    ports:
      # Loopback-only: security is disabled, so never expose beyond the dev host.
      - "127.0.0.1:9201:9200"   # 9201 avoids clashing with a local ES7
    volumes:
      - es8data:/usr/share/elasticsearch/data
volumes:
  es8data:
```

- [ ] **Step 2: Start it** (ingest-attachment is a bundled MODULE in ES8 — no install needed)

In ES 8.x `ingest-attachment` ships as a module in the default distribution; the old
`elasticsearch-plugin install ingest-attachment` is a no-op ("no longer a plugin but
instead a module"). So just start the container — the attachment processor is already present.
```bash
docker compose -f config/elasticsearch/docker-compose.es8.yml up -d
```

- [ ] **Step 3: Verify it is up and reports 8.17.x**

Run: `curl -s localhost:9201 | grep number`
Expected: `"number" : "8.17.1"`

- [ ] **Step 4: Commit**

```bash
git add config/elasticsearch/docker-compose.es8.yml
git commit -m "Add local Docker ES8 for upgrade development"
```

### Task 0.2: Load a real data subset from ES7 into local Docker (carries embeddings)

Pull a representative slice of the **real** corpus from ES7 into local Docker via
remote `_reindex`. This carries the existing `embeddings_vector` / `image_embedding`
values (no OpenAI cost) so the kNN relevance check (Task 3.5) is meaningful. The
destination must have the new indexed-`dense_vector` mapping first (Task 3.1 creates
the `bordercore_test` index from `mappings.json` — run that before this task, or
reuse its index here).

> Networking: the local Docker container makes the outbound call to ES7:9200, so the
> dev machine's egress IP must be in the ES7 security-group allowlist (it already lists
> the dev IPs that curl/ssh ES7 today). Set `ES7_REINDEX_WHITELIST` to the ES7 host:port
> used in `docker-compose.es8.yml` and recreate the container so the whitelist applies.

- [ ] **Step 1: Recreate the container with the ES7 whitelist set**

Run:
```bash
ES7_REINDEX_WHITELIST=<es7-host>:9200 \
  docker compose -f config/elasticsearch/docker-compose.es8.yml up -d --force-recreate
```
Expected: container restarts; `curl -s localhost:9201/_cluster/settings` round-trips.

- [ ] **Step 2: Apply the indexed-dense_vector mapping change first, then create the index**

Task 2.1 (editing `embeddings_vector` to `index: true` in `mappings.json`) is a one-line
change with no code dependency — **do it now** so the local index is created with the
kNN-ready mapping from the start. (Tasks are listed by phase, but this mapping edit is a
prerequisite for the local kNN tests; doing it here avoids a later delete-and-recreate.)

Run:
```bash
curl -s -X PUT localhost:9201/bordercore_test \
  -H 'Content-Type: application/json' \
  --data-binary @config/elasticsearch/mappings.json | python3 -m json.tool
```
Expected: `"acknowledged": true`, and `embeddings_vector` in the resulting mapping shows
`"index": true, "similarity": "cosine"`.

Then apply the `image_embedding` mapping (it lives in the management command, not
`mappings.json`). Without this, the reindex's copied `image_embedding` arrays get
dynamically mapped as plain `float` and kNN on them (Task 3.4) fails:
```bash
ELASTICSEARCH_ENDPOINT=http://localhost:9201 ELASTICSEARCH_INDEX=bordercore_test \
  script -qc '.venv/bin/python bordercore/manage.py add_image_embedding_mapping' /dev/null
```
Expected: `image_embedding` shows `"type": "dense_vector", "index": true`.
(This command requires Task 1.5's es8 `put_mapping` fix; if running Phase 0 before Phase 1,
apply that one-line fix first or PUT the mapping with a raw curl instead.)

- [ ] **Step 3: Remote-reindex a subset (all notes + a sample of other doctypes)**

Run (replace `<es7-host>`; this pulls every `note` plus up to 500 of everything else):
```bash
curl -s -X POST localhost:9201/_reindex \
  -H 'Content-Type: application/json' -d '{
  "source": {
    "remote": { "host": "http://<es7-host>:9200" },
    "index": "bordercore",
    "query": { "bool": { "should": [
      { "term": { "doctype": "note" } },
      { "function_score": { "random_score": {} } }
    ], "minimum_should_match": 1 } },
    "size": 500
  },
  "max_docs": 2000,
  "dest": { "index": "bordercore_test" }
}' | python3 -m json.tool
```
Expected: `"created"` count > 0, `"failures": []`. (Tune `max_docs` to taste; all notes are the part that matters for relevance.)

- [ ] **Step 4: Verify embeddings came across**

Run: `curl -s "localhost:9201/bordercore_test/_search?size=0" -H 'Content-Type: application/json' -d '{"query":{"exists":{"field":"embeddings_vector"}}}' | python3 -c "import sys,json;print(json.load(sys.stdin)['hits']['total'])"`
Expected: a non-zero count (notes with vectors). This index now backs all `data_quality` tests in Phases 1–3.

---

## Phase 1: Python client migration (es7 → es8)

The es8 Python client removes `RequestsHttpConnection`/`connection_class` (new `elastic_transport` backend) and deprecates the `body=` kwarg in favor of typed keyword params. This phase keeps **behavior identical** — only the client API changes. Validated against local ES8 (9201) via the data_quality suite.

### Task 1.1: Bump the client libraries

**Files:**
- Modify: `pyproject.toml:17-18`

- [ ] **Step 1: Change the pins**

In `pyproject.toml`, replace:
```toml
    "elasticsearch==7.17.13",
    "elasticsearch-dsl==7.4.0",
```
with:
```toml
    "elasticsearch==8.17.1",
    "elasticsearch-dsl==8.17.1",
```

- [ ] **Step 2: Install**

Run: `script -qc 'uv sync' /dev/null`
Expected: resolves and installs `elasticsearch-8.17.1`, `elasticsearch-dsl-8.17.1`.

- [ ] **Step 3: Confirm versions**

Run: `.venv/bin/python -c "import elasticsearch, elasticsearch_dsl; print(elasticsearch.__version__, elasticsearch_dsl.__version__)"`
Expected: `(8, 17, 1) 8.17.1`

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml uv.lock
git commit -m "Bump elasticsearch + elasticsearch-dsl to 8.17.1"
```

### Task 1.2: Rewrite the main connection factory

The es8 client constructs directly with `Elasticsearch(hosts=[...])`; there is no `connection_class`. `elasticsearch_dsl.connections.create_connection` still exists in dsl 8 and accepts the same kwargs the es8 client does, so we keep using it but drop the removed args.

**Files:**
- Modify: `bordercore/lib/util.py:36-63`

- [ ] **Step 1: Add a failing data_quality test for the connection**

Add to `bordercore/lib/tests/test_util.py` (create the file if it does not exist; mirror the import style of a neighboring `*/tests/test_*.py`):

```python
import os

import pytest


@pytest.mark.data_quality
def test_get_elasticsearch_connection_pings_es8():
    """The es8 client connects and reports an 8.x server."""
    from lib.util import get_elasticsearch_connection

    es = get_elasticsearch_connection(host=os.environ["ELASTICSEARCH_ENDPOINT"])
    info = es.info()
    assert info["version"]["number"].startswith("8."), info["version"]["number"]
```

- [ ] **Step 2: Run it against local ES8 and watch it fail on the old client code**

Run: `ELASTICSEARCH_ENDPOINT=http://localhost:9201 script -qc '.venv/bin/python -m pytest bordercore/lib/tests/test_util.py::test_get_elasticsearch_connection_pings_es8 -v -m data_quality' /dev/null`
Expected: FAIL — `ImportError: cannot import name 'RequestsHttpConnection'` (removed in es8).

- [ ] **Step 3: Rewrite `_get_elasticsearch_connection`**

Replace the body of `_get_elasticsearch_connection` (lines 50-63) with:

```python
    # Isolate the import here so other functions from this module
    #  can be imported without requiring these dependencies.
    from elasticsearch_dsl.connections import connections

    if not host:
        host = os.environ.get("ELASTICSEARCH_ENDPOINT", "http://localhost:9200")

    # es8 transport: no connection_class / use_ssl. TLS is implied by an
    # https:// host. `request_timeout` replaces the old `timeout` kwarg.
    return connections.create_connection(
        hosts=[host],
        request_timeout=timeout,
    )
```

Note: the default host gains an explicit `http://` scheme — the es8 client requires a scheme in the host URL.

- [ ] **Step 4: Run the test, now passing**

Run: `ELASTICSEARCH_ENDPOINT=http://localhost:9201 script -qc '.venv/bin/python -m pytest bordercore/lib/tests/test_util.py::test_get_elasticsearch_connection_pings_es8 -v -m data_quality' /dev/null`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bordercore/lib/util.py bordercore/lib/tests/test_util.py
git commit -m "Port main ES connection factory to es8 client"
```

### Task 1.3: Rewrite the 4 Lambda connection copies

Each Lambda has its own `lib/util.py` with the same removed `RequestsHttpConnection` pattern. They construct the client directly (not via dsl). Apply the same fix to all four.

**Files:**
- Modify: `bordercore/aws/index_blobs/lib/util.py:39-62`
- Modify: `bordercore/aws/create_bookmark_thumbnail/lib/util.py:39-62`
- Modify: `bordercore/aws/create_collection_thumbnail/lib/util.py:52-62`
- Modify: `bordercore/aws/create_thumbnail/lib/util.py:52-62`

- [ ] **Step 1: Inspect one to confirm the shared shape**

Run: `sed -n '30,65p' bordercore/aws/index_blobs/lib/util.py`
Expected: a `from elasticsearch import ... RequestsHttpConnection` import and an `Elasticsearch(hosts=[...], connection_class=RequestsHttpConnection, use_ssl=False, ...)` (or `connections.create_connection`) call.

- [ ] **Step 2: Rewrite each file's connection function**

In **each** of the four files, replace the import and constructor with the es8 form. For the direct-client variant:

```python
    from elasticsearch import Elasticsearch

    if not host:
        host = os.environ.get("ELASTICSEARCH_ENDPOINT", "http://localhost:9200")

    return Elasticsearch(
        hosts=[host],
        request_timeout=timeout,
    )
```

If a file uses `connections.create_connection` instead, use the dsl form from Task 1.2 Step 3. Preserve each file's existing function signature and docstring; only the import + constructor change.

- [ ] **Step 3: Bump each Lambda's pinned client**

Each Lambda dir has its own `requirements.txt`. Run to find them:
`grep -rl "elasticsearch==" bordercore/aws/*/requirements.txt`
In each, change the `elasticsearch==7.*` pin to `elasticsearch==8.17.1` (these Lambdas use the bare client, not dsl).

- [ ] **Step 4: Syntax-check all four**

Run: `for f in index_blobs create_bookmark_thumbnail create_collection_thumbnail create_thumbnail; do .venv/bin/python -m py_compile bordercore/aws/$f/lib/util.py && echo "$f OK"; done`
Expected: four `OK` lines.

- [ ] **Step 5: Commit**

```bash
git add bordercore/aws/*/lib/util.py bordercore/aws/*/requirements.txt
git commit -m "Port Lambda ES connections to es8 client"
```

### Task 1.4: Remove deprecated `body=` from search/get/mget/delete calls

es8 deprecates `body=`; pass the query parts as top-level keyword args. The `**search_object` spread in `execute_search` already works because the es8 `search()` accepts `query`, `size`, `from_`, `aggs`, `highlight`, `sort`, `post_filter`, `knn`, `_source` as keywords — but it does **not** accept `from_`? It does (`from_`). Verify and fix the explicit `body=` sites.

**Files:**
- Modify: `bordercore/search/services.py:540` (`find_similar_images`, `es.search(... body=body)`)
- Modify: `bordercore/search/services.py:594` (`es.mget(index=index, body={"ids": uuids})`)

- [ ] **Step 1: Add a failing data_quality test for mget shape**

Add to `bordercore/search/tests/test_services.py` (append; match existing import style):

```python
@pytest.mark.data_quality
def test_mget_uses_es8_kwargs():
    """mget works with es8 keyword args (no body=)."""
    from django.conf import settings

    from lib.util import get_elasticsearch_connection
    from search.services import get_elasticsearch_source_fields  # noqa: F401

    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)
    # docs="ids" form; empty list returns an empty docs array, no error.
    resp = es.mget(index=settings.ELASTICSEARCH_INDEX, ids=[])
    assert resp["docs"] == []
```

- [ ] **Step 2: Run it; watch it fail**

Run: `ELASTICSEARCH_ENDPOINT=http://localhost:9201 ELASTICSEARCH_INDEX=bordercore_test script -qc '.venv/bin/python -m pytest bordercore/search/tests/test_services.py::test_mget_uses_es8_kwargs -v -m data_quality' /dev/null`
Expected: FAIL (index missing or, after Phase 3 mapping task, PASS). If the index does not exist yet, create it first via Task 3.1, then return here. Until then, expecting `NotFoundError` is acceptable as the "fail" state.

- [ ] **Step 3: Convert the mget call** (`search/services.py:594`)

Replace:
```python
    response = es.mget(index=index, body={"ids": uuids})
```
with:
```python
    response = es.mget(index=index, ids=uuids)
```

- [ ] **Step 4: Convert the find_similar_images search call** (`search/services.py:540`)

This call is replaced wholesale in Task 3.4 (kNN). For now, make it es8-valid by spreading `body`:
```python
    response = es.search(index=index, **body)
```

- [ ] **Step 5: Run the mget test, now passing (index must exist)**

Run the Step 2 command again.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add bordercore/search/services.py bordercore/search/tests/test_services.py
git commit -m "Drop deprecated body= from es8 mget/search calls"
```

### Task 1.5: Convert remaining `body=` sites (update_by_query, put_mapping)

**Files:**
- Modify: `bordercore/blob/elasticsearch_indexer.py:365` (`es.update_by_query(body=q, ...)`)
- Modify: `bordercore/blob/management/commands/populate-size.py:160`
- Modify: `bordercore/blob/management/commands/populate-num-pages.py:160`
- Modify: `bordercore/blob/management/commands/update-elasticsearch-field.py:77`
- Modify: `bordercore/blob/management/commands/add_image_embedding_mapping.py:27`

- [ ] **Step 1: Convert each `update_by_query` call**

For each `update_by_query(body=<X>, index=<I>)` where `<X>` is `{"query": {...}, "script": {...}}`, change to:
```python
es.update_by_query(index=<I>, query=<X>["query"], script=<X>["script"])
```
If `<X>` only contains `query`, pass only `query=`. Inspect each call's `body` dict and map its top-level keys to keyword args.

- [ ] **Step 2: Convert the put_mapping call** (`add_image_embedding_mapping.py:27`)

Replace `es.indices.put_mapping(index=..., body=body)` with:
```python
es.indices.put_mapping(index=settings.ELASTICSEARCH_INDEX, properties=body["properties"])
```
(es8 `put_mapping` takes `properties=` directly.)

- [ ] **Step 3: Compile-check all five**

Run: `.venv/bin/python -m py_compile bordercore/blob/elasticsearch_indexer.py bordercore/blob/management/commands/populate-size.py bordercore/blob/management/commands/populate-num-pages.py bordercore/blob/management/commands/update-elasticsearch-field.py bordercore/blob/management/commands/add_image_embedding_mapping.py && echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add bordercore/blob/elasticsearch_indexer.py bordercore/blob/management/commands/populate-size.py bordercore/blob/management/commands/populate-num-pages.py bordercore/blob/management/commands/update-elasticsearch-field.py bordercore/blob/management/commands/add_image_embedding_mapping.py
git commit -m "Convert remaining es8 update_by_query/put_mapping calls off body="
```

### Task 1.6: Verify elasticsearch-dsl 8 Document API (ESBlob)

`ESBlob(Document)` uses `.save(**pipeline_args)` and `.update(doc_as_upsert=True, **fields)`. dsl 8 keeps these but the connection alias and `Index` meta may need a touch.

**Files:**
- Modify (if needed): `bordercore/blob/elasticsearch_indexer.py` (ESBlob class + save/update sites ~:484, :495)
- Modify (if needed): `bordercore/aws/index_blobs/lib/elasticsearch_indexer.py:422,582`

- [ ] **Step 1: Add a failing data_quality round-trip test**

Add to `bordercore/blob/tests/test_elasticsearch_indexer.py` (append; match existing style). Use a throwaway uuid:

```python
@pytest.mark.data_quality
def test_esblob_save_update_roundtrip():
    """ESBlob.save + update work on dsl 8 against ES8."""
    import os

    from elasticsearch_dsl.connections import connections

    from blob.elasticsearch_indexer import ESBlob  # adjust if class lives elsewhere

    connections.create_connection(hosts=[os.environ["ELASTICSEARCH_ENDPOINT"]])
    doc = ESBlob(meta={"id": "dsl8-roundtrip-test"})
    doc.name = "dsl8 roundtrip"
    doc.user_id = 1
    doc.save(index=os.environ["ELASTICSEARCH_INDEX"])
    fetched = ESBlob.get(id="dsl8-roundtrip-test", index=os.environ["ELASTICSEARCH_INDEX"])
    assert fetched.name == "dsl8 roundtrip"
    fetched.delete(index=os.environ["ELASTICSEARCH_INDEX"])
```

- [ ] **Step 2: Run it against local ES8**

Run: `ELASTICSEARCH_ENDPOINT=http://localhost:9201 ELASTICSEARCH_INDEX=bordercore_test script -qc '.venv/bin/python -m pytest bordercore/blob/tests/test_elasticsearch_indexer.py::test_esblob_save_update_roundtrip -v -m data_quality' /dev/null`
Expected: PASS if dsl 8 is API-compatible. If FAIL, read the traceback and apply the minimal dsl-8 fix (commonly: `class Index:` meta on the Document, or passing `using=`/`index=` explicitly). Re-run until PASS.

- [ ] **Step 3: Commit**

```bash
git add bordercore/blob/tests/test_elasticsearch_indexer.py bordercore/blob/elasticsearch_indexer.py
git commit -m "Verify ESBlob save/update on elasticsearch-dsl 8"
```

### Task 1.7: Full mocked unit suite stays green

- [ ] **Step 1: Run the ES-touching unit tests (mocked)**

Run: `script -qc '.venv/bin/python -m pytest bordercore/search bordercore/blob -q' /dev/null`
Expected: PASS (these mock ES; this confirms the client swap did not break import-time or non-data_quality code paths).

- [ ] **Step 2: Run mypy**

Run: `script -qc 'uv run mypy bordercore/lib/util.py bordercore/search/services.py bordercore/blob/elasticsearch_indexer.py' /dev/null`
Expected: no new errors from the client change.

---

## Phase 2: Mapping changes (indexed dense_vector)

### Task 2.1: Make `embeddings_vector` an indexed dense_vector

**Files:**
- Modify: `config/elasticsearch/mappings.json:123-126`

- [ ] **Step 1: Update the mapping**

Replace:
```json
      "embeddings_vector": {
        "type": "dense_vector",
        "dims": 1536
      },
```
with:
```json
      "embeddings_vector": {
        "type": "dense_vector",
        "dims": 1536,
        "index": true,
        "similarity": "cosine",
        "index_options": { "type": "int8_hnsw" }
      },
```
(Mirrors the already-indexed `image_embedding` field; int8 quantization keeps the HNSW graph small for the 4 GB box.)

- [ ] **Step 2: Validate the JSON parses**

Run: `.venv/bin/python -c "import json; json.load(open('config/elasticsearch/mappings.json')); print('valid')"`
Expected: `valid`.

- [ ] **Step 3: Commit**

```bash
git add config/elasticsearch/mappings.json
git commit -m "Index embeddings_vector as kNN dense_vector (int8_hnsw, cosine)"
```

### Task 3.1: Confirm the local index is kNN-ready

The `bordercore_test` index was already created with the indexed-`dense_vector` mapping
in **Task 0.2** (and seeded with the real ES7 subset). This task is just a guard before
the kNN conversions.

- [ ] **Step 1: Verify the dense_vector is indexed and populated**

Run: `curl -s localhost:9201/bordercore_test/_mapping | python3 -c "import sys,json; m=json.load(sys.stdin); print(m['bordercore_test']['mappings']['properties']['embeddings_vector'])"`
Expected: shows `'index': True, 'similarity': 'cosine'`. If not, the index predates Task 2.1's
mapping edit — delete it, re-run Task 2.1, then re-run Task 0.2.

---

## Phase 3: Convert script_score sites to native kNN

ES8 kNN with cosine similarity returns a score of `(1 + cosine) / 2` in `[0, 1]` — **different normalization** from the old `cosineSimilarity(...) + 1.0` (range `[0, 2]`). The image path's "halve that" math (`_score / 2.0`) must be removed; the notes/semantic thresholds must be re-derived. Each conversion gets a data_quality test that asserts the score range.

### Task 3.2: Convert `semantic_search()` (Notes RAG) to kNN

**Files:**
- Modify: `bordercore/search/services.py:629-689`

- [ ] **Step 1: Add a failing data_quality test**

Append to `bordercore/search/tests/test_services.py`:

```python
@pytest.mark.data_quality
def test_semantic_search_returns_knn_scores_in_unit_range(rf):
    """semantic_search uses native kNN; scores land in [0, 1]."""
    from django.conf import settings

    from search.services import semantic_search
    # Requires the local ES8 index to contain at least one `note` doc with an
    # embeddings_vector for user_id=1. The data_quality fixture/seed provides this.
    request = rf.get("/")
    request.user = _data_quality_user()  # existing helper in the data_quality suite
    out = semantic_search(request, "test query", size=5)
    for hit in out["hits"]["hits"]:
        assert 0.0 <= hit["_score"] <= 1.0, hit["_score"]
```

- [ ] **Step 2: Run it; watch it fail** (old script_score yields scores up to 2.0)

Run: `ELASTICSEARCH_ENDPOINT=http://localhost:9201 ELASTICSEARCH_INDEX=bordercore_test script -qc '.venv/bin/python -m pytest bordercore/search/tests/test_services.py::test_semantic_search_returns_knn_scores_in_unit_range -v -m data_quality' /dev/null`
Expected: FAIL (score > 1.0, or the script_score query shape).

- [ ] **Step 3: Replace the query construction**

Replace lines 653-685 (from `embeddings = ...` through the `try/return execute_search`) with a native kNN search. kNN is a top-level search param with its own `filter`, so we bypass the `function_score` skeleton:

```python
    embeddings = len_safe_get_embedding(search)

    knn_search: dict[str, Any] = {
        "knn": {
            "field": "embeddings_vector",
            "query_vector": embeddings,
            "k": size,
            "num_candidates": max(size * 10, 100),
            "filter": [
                {"term": {"user_id": cast(int, request.user.id)}},
                {"term": {"doctype": "note"}},
            ],
        },
        "size": size,
        "_source": [
            "date", "contents", "doctype", "name", "title", "url", "uuid",
        ],
    }

    try:
        return execute_search(knn_search)
    except RequestError as e:
        error_info = cast(dict[str, Any], e.info)
        messages.add_message(request, messages.ERROR, f"Request Error: {e.status_code} {error_info.get('error')}")
        return {"hits": {"hits": [], "total": {"value": 0}}}
```

`build_base_query` is no longer used here; remove its now-dead import only if no other function in the file uses it (it is still used by `perform_search`, so leave the import).

- [ ] **Step 4: Run the test, now passing**

Run the Step 2 command again.
Expected: PASS (all scores in `[0, 1]`).

- [ ] **Step 5: Commit**

```bash
git add bordercore/search/services.py bordercore/search/tests/test_services.py
git commit -m "Convert semantic_search (Notes RAG) to native kNN"
```

### Task 3.3: Convert `perform_search()` semantic mode to kNN

The semantic branch (`search/services.py:374-387`) currently swaps `functions` for a script_score while keeping aggs/highlight/sort/post_filter. Convert it to a top-level `knn` block, folding the existing `user_id`/tags filters into `knn.filter`.

**Files:**
- Modify: `bordercore/search/services.py:373-399`

- [ ] **Step 1: Add a failing data_quality test**

Append to `bordercore/search/tests/test_services.py`:

```python
@pytest.mark.data_quality
def test_perform_search_semantic_uses_knn(rf):
    """perform_search semantic mode returns kNN-scored hits in [0, 1]."""
    from search.services import perform_search

    request = rf.get("/", {"semantic_search": "test", "is_semantic": "1"})
    request.user = _data_quality_user()
    out = perform_search(request)  # adjust call signature to match the real one
    for hit in out["results"]:
        assert 0.0 <= hit["_score"] <= 1.0, hit["_score"]
```

(Adjust the `perform_search` invocation to its real signature — inspect lines 308-340.)

- [ ] **Step 2: Run it; watch it fail**

Run: `ELASTICSEARCH_ENDPOINT=http://localhost:9201 ELASTICSEARCH_INDEX=bordercore_test script -qc '.venv/bin/python -m pytest bordercore/search/tests/test_services.py::test_perform_search_semantic_uses_knn -v -m data_quality' /dev/null`
Expected: FAIL.

- [ ] **Step 3: Replace the semantic branch**

Replace lines 373-387 (the `if is_semantic:` block) with kNN that carries the same user filter and any tag filters. Because the tag filter is appended later (lines 394-399) into `function_score.query.bool.must`, restructure so semantic mode collects filters into a list used by `knn.filter`:

```python
    # Semantic search: replace scoring with native kNN
    if is_semantic:
        semantic_term = params.get("semantic_search", "")
        embeddings = len_safe_get_embedding(semantic_term)
        knn_filter: list[dict[str, Any]] = [{"term": {"user_id": cast(int, user.id)}}]
        for tag in params.getlist("tags"):
            knn_filter.append({"term": {"tags.keyword": tag}})
        if doctype:
            knn_filter.append({"term": {"doctype": doctype}})
        search_object.pop("query", None)
        search_object.pop("post_filter", None)
        search_object["knn"] = {
            "field": "embeddings_vector",
            "query_vector": embeddings,
            "k": RESULT_COUNT_PER_PAGE,
            "num_candidates": 200,
            "filter": knn_filter,
        }
        search_object["sort"] = {"_score": {"order": "desc"}}
```

Then guard the later tag-filter and text-query blocks (lines 393-423) so they only run in the **non-semantic** path:
```python
    if not is_semantic:
        # existing tag-filter block (394-399)
        # existing text-query block (402-423)
```
(Indent the existing blocks under this guard. The doctype post_filter at 389-391 is folded into `knn_filter` above for the semantic path; keep it for the non-semantic path under the same `if not is_semantic:` guard or leave it before the guard since it is a no-op when `knn` owns filtering — simplest is to move it inside the guard.)

- [ ] **Step 4: Run the test, now passing**

Run the Step 2 command again.
Expected: PASS.

- [ ] **Step 5: Run the full mocked search unit suite to confirm non-semantic path intact**

Run: `script -qc '.venv/bin/python -m pytest bordercore/search -q' /dev/null`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add bordercore/search/services.py bordercore/search/tests/test_services.py
git commit -m "Convert perform_search semantic mode to native kNN"
```

### Task 3.4: Convert `find_similar_images()` to kNN

**Files:**
- Modify: `bordercore/search/services.py:510-547`

- [ ] **Step 1: Update the docstring score note + add failing test**

Append to `bordercore/search/tests/test_services.py`:

```python
@pytest.mark.data_quality
def test_find_similar_images_threshold_unit_range():
    """find_similar_images returns cosine similarities in [0, 1] via kNN."""
    from search.services import find_similar_images

    # Seeded image blob with an image_embedding for user_id=1.
    results = find_similar_images(1, text="a cat", threshold=0.0, limit=5)
    for _uuid, sim in results:
        assert 0.0 <= sim <= 1.0, sim
```

- [ ] **Step 2: Run it; watch it fail** (old path divides by 2.0 from a [0,2] score)

Run: `ELASTICSEARCH_ENDPOINT=http://localhost:9201 ELASTICSEARCH_INDEX=bordercore_test script -qc '.venv/bin/python -m pytest bordercore/search/tests/test_services.py::test_find_similar_images_threshold_unit_range -v -m data_quality' /dev/null`
Expected: FAIL or error (script_score body shape / scoring).

- [ ] **Step 3: Replace the script_score body with a kNN search**

Replace lines 517-547 (the `body = {...}` through the result loop) with:

```python
    knn_query: dict[str, Any] = {
        "field": "image_embedding",
        "query_vector": vector,
        "k": limit,
        "num_candidates": max(limit * 10, 100),
        "filter": filter_clauses,
    }

    response = es.search(
        index=index,
        knn=knn_query,
        size=limit,
        source=False,
    )
    out: list[tuple[str, float]] = []
    for hit in response["hits"]["hits"]:
        # Native cosine kNN already returns (1 + cosine) / 2 in [0, 1].
        similarity = hit["_score"]
        if similarity >= threshold:
            out.append((hit["_id"], similarity))
    return out
```

Also delete the now-unused `must_clauses` `{"exists": ...}` (kNN only scores docs that have the vector) — keep `filter_clauses` (user + must_not self). Update the docstring paragraph at lines 458-461 to remove the "we halve that" sentence and state scores are native `[0, 1]`.

- [ ] **Step 4: Run the test, now passing**

Run the Step 2 command again.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bordercore/search/services.py bordercore/search/tests/test_services.py
git commit -m "Convert find_similar_images to native kNN; drop [0,2]→[0,1] halving"
```

### Task 3.5: Before/after relevance check (notes)

**Files:**
- Create: `docs/superpowers/notes/es8-knn-relevance-check.md` (scratch, not committed to code paths)

- [ ] **Step 1: Pick ~10 real note questions and capture ES7 results**

Against the **current ES7** (`$ES7_HOST`), run each query through `semantic_search` (on the pre-upgrade `main` branch checkout or by temporarily pointing at ES7) and record the top-3 note titles + scores.

- [ ] **Step 2: Capture ES8 kNN results for the same queries**

Against local ES8 (seeded with the same notes), run the upgraded `semantic_search` and record top-3 titles + scores.

- [ ] **Step 3: Compare and set a threshold**

Confirm the top hits are substantially the same set. Choose a `min_score` cutoff in the new `[0, 1]` scale (the RAG doc's "raw similarity < 0.3" maps to kNN score `< 0.65`). Record the chosen cutoff in the notes file. (Applying the cutoff in code is RAG-project work, not this plan — this task only validates and documents.)

---

## Phase 4: Provision the new EC2 ES8 instance

> Operational runbook. "Tests" are verification commands. Use the existing AWS CLI creds (`bordercore-cli`). Capture every created resource ID into `docs/superpowers/notes/es8-infra.md` as you go.

### Task 4.1: Launch the instance

- [ ] **Step 1: Clone the security group**

Create a new SG mirroring `sg-0af074ec5a6fd9892` (`launch-wizard-4`): allow 22 + 9200 to the same IP allowlist; **omit** the stale JMX 3333-3334 rule.
Run:
```bash
aws ec2 create-security-group --group-name es8-bordercore --description "ES8 bordercore" --vpc-id <same-vpc-as-current> --query GroupId --output text
```
Then add ingress for 22 and 9200 for each CIDR in the current allowlist (`64.112.178.0/32`, `64.112.179.226/32`, `64.112.177.251/32`, `174.168.181.97/32`, `172.31.7.187/32`, `64.112.177.189/32`, `67.140.235.23/32`, `64.112.177.0/32` — confirm against `describe-security-groups` output).

- [ ] **Step 2: Launch a t3a.medium Ubuntu 24.04 in us-east-1c with a 35 GB gp3 data volume**

Run (fill in the latest Ubuntu 24.04 AMI for us-east-1, your keypair, the new SG, and subnet in us-east-1c):
```bash
aws ec2 run-instances \
  --image-id <ubuntu-24.04-amd64-ami> \
  --instance-type t3a.medium \
  --key-name <your-keypair> \
  --security-group-ids <new-sg-id> \
  --subnet-id <us-east-1c-subnet> \
  --block-device-mappings '[
    {"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":12,"VolumeType":"gp3","DeleteOnTermination":true}},
    {"DeviceName":"/dev/sdf","Ebs":{"VolumeSize":35,"VolumeType":"gp3","DeleteOnTermination":false}}
  ]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=elasticsearch-8}]' \
  --query 'Instances[0].InstanceId' --output text
```
(Root bumped to 12 GB — the current 8 GB root sits at 97%. Data on a dedicated 35 GB gp3.)

- [ ] **Step 3: Verify it is running and reachable on SSH**

Run: `aws ec2 describe-instances --instance-ids <new-id> --query 'Reservations[].Instances[].State.Name' --output text` → `running`, then `ssh ubuntu@<new-private-or-public-ip> 'echo ok'` → `ok`.

### Task 4.2: Mount the data volume

- [ ] **Step 1: Format and mount the 35 GB volume at /var/lib/elasticsearch**

On the new host:
```bash
sudo mkfs.ext4 /dev/nvme1n1     # confirm device name with lsblk first
sudo mkdir -p /var/lib/elasticsearch
echo "/dev/nvme1n1 /var/lib/elasticsearch ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
sudo mount -a
```

- [ ] **Step 2: Verify the mount**

Run: `df -h /var/lib/elasticsearch`
Expected: ~34 GB filesystem mounted.

### Task 4.3: Install ES 8.17.x via apt + systemd

- [ ] **Step 1: Add Elastic's apt repo and install**

On the new host:
```bash
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
sudo apt-get update
sudo apt-get install -y elasticsearch=8.17.1
```
(Capture the auto-generated `elastic` password printed on install — unused since security is off, but note it.)

- [ ] **Step 2: Write `/etc/elasticsearch/elasticsearch.yml`**

```yaml
cluster.name: bordercore
node.name: node-1
path.data: /var/lib/elasticsearch
path.logs: /var/log/elasticsearch
network.host: 0.0.0.0
http.port: 9200
discovery.type: single-node
http.max_content_length: 250mb
xpack.security.enabled: false
xpack.security.http.ssl.enabled: false
xpack.security.transport.ssl.enabled: false
# Allow remote _reindex to pull the existing corpus (incl. embeddings) from ES7.
# Set to the ES7 host:port reachable from this instance. Can be removed after cutover.
reindex.remote.whitelist: "<es7-host>:9200"
```

> The new ES8 box must be able to reach the ES7 host on 9200. ES7's security group must
> allow inbound 9200 from the ES8 instance's private IP (or both are in the same VPC).

- [ ] **Step 3: Set heap to 2 GB**

```bash
echo -e "-Xms2g\n-Xmx2g" | sudo tee /etc/elasticsearch/jvm.options.d/heap.options
sudo chown root:elasticsearch /var/lib/elasticsearch
```

- [ ] **Step 4: Enable and start the service** (ingest-attachment is bundled in ES8 — no install)

`ingest-attachment` is a module in the ES8 default distribution; do NOT run
`elasticsearch-plugin install ingest-attachment` (it's a no-op in 8.x). Just start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable elasticsearch
sudo systemctl start elasticsearch
```

- [ ] **Step 5: Verify version, health, and plugin**

Run (on the host): `curl -s localhost:9200 | grep number` → `8.17.1`; `curl -s localhost:9200/_cluster/health` → `"status":"green"` (single-node, no replicas) or `yellow` (acceptable). Confirm the attachment processor is present (it's a bundled module, so `_cat/plugins` will NOT list it): `curl -s localhost:9200/_nodes/ingest | python3 -c "import sys,json;print('attachment' in str(json.load(sys.stdin)['nodes']))"` → `True`.

### Task 4.4: Create the index and ingest pipeline on the new instance

- [ ] **Step 1: Create the `bordercore` index from mappings.json**

From the repo (with SG access to 9200) or by copying the file to the host:
```bash
curl -s -X PUT $ES8_HOST/bordercore \
  -H 'Content-Type: application/json' \
  --data-binary @config/elasticsearch/mappings.json
```
Expected: `"acknowledged": true`.

- [ ] **Step 2: Recreate the attachment ingest pipeline**

```bash
curl -s -X PUT $ES8_HOST/_ingest/pipeline/attachment \
  -H 'Content-Type: application/json' \
  --data-binary @config/elasticsearch/ingest_pipeline.json
```
Expected: `"acknowledged": true`. (Confirm the pipeline name matches what `elasticsearch_indexer.py:481` passes — `attachment`.)

- [ ] **Step 3: Add the image_embedding mapping**

The `embeddings_vector` is in mappings.json; `image_embedding` is added separately. Run the management command against the new host:
```bash
ELASTICSEARCH_ENDPOINT=$ES8_HOST script -qc '.venv/bin/python bordercore/manage.py add_image_embedding_mapping' /dev/null
```
Expected: success; verify `curl -s $ES8_HOST/bordercore/_mapping` shows both vector fields with `index: true`.

---

## Phase 5: Carry the corpus over from ES7 (remote reindex)

Rather than rebuilding from the DB and re-embedding ~22k docs via OpenAI, we remote-reindex
the existing ES7 corpus into the new ES8 index. The `_reindex` copies each doc's `_source`
(including `embeddings_vector` and `image_embedding`) into the new **indexed**-`dense_vector`
mapping, so ES8 builds the HNSW graphs automatically with no embedding recompute. Only docs
changed *after* the reindex get re-embedded (Task 5.2).

### Task 5.1: Remote-reindex the full corpus ES7 → ES8

- [ ] **Step 1: Record a high-water timestamp before starting**

Note the wall-clock time (UTC) just before the reindex; call it `$REINDEX_START`. Used in
Task 5.2 to find docs changed during/after the copy. (The index has a `last_modified` field.)

- [ ] **Step 2: Kick off the remote reindex (async)**

From the new ES8 host (whitelist set in Task 4.3), run. NOTE: remote reindex does **not**
support `slices` (auto or >1) — it is single-threaded by design; do not add `slices`:
```bash
curl -s -X POST "$ES8_HOST/_reindex?wait_for_completion=false" \
  -H 'Content-Type: application/json' -d '{
  "source": {
    "remote": { "host": "http://<es7-host>:9200", "socket_timeout": "120s" },
    "index": "bordercore",
    "size": 1000
  },
  "dest": { "index": "bordercore" }
}'
```
Expected: returns a `"task"` id (e.g. `node:12345`).

- [ ] **Step 3: Poll the task to completion**

Run: `curl -s "$ES8_HOST/_tasks/<task-id>" | python3 -c "import sys,json;t=json.load(sys.stdin);print(t.get('completed'), t['task']['status'])"`
Expected: eventually `True ...` with `"failures": []` and `created` ≈ ES7 doc count (22,105).

- [ ] **Step 4: Verify per-doctype counts match ES7**

Run on both hosts and compare:
```bash
for H in $ES7_HOST $ES8_HOST; do echo "== $H =="; curl -s "$H/bordercore/_search?size=0" -H 'Content-Type: application/json' -d '{"aggs":{"by_type":{"terms":{"field":"doctype","size":20}}}}' | python3 -c "import sys,json;[print(b['key'],b['doc_count']) for b in json.load(sys.stdin)['aggregations']['by_type']['buckets']]"; done
```
Expected: counts match per doctype.

- [ ] **Step 5: Verify embeddings came across and are kNN-searchable**

Run: `curl -s "$ES8_HOST/bordercore/_search?size=0" -H 'Content-Type: application/json' -d '{"query":{"exists":{"field":"embeddings_vector"}}}' | python3 -c "import sys,json;print(json.load(sys.stdin)['hits']['total'])"`
Expected: matches the same query against `$ES7_HOST`. Then run a sample `knn` query
(`field: embeddings_vector`) and confirm it returns hits with scores in `[0, 1]`.

### Task 5.2: Re-embed only docs changed during/after the copy

A remote reindex is a point-in-time copy; notes/blobs edited while it ran (or between the
copy and cutover) may carry a stale or missing vector. Recompute embeddings just for those.

- [ ] **Step 1: Find docs modified at/after `$REINDEX_START`**

Run: `curl -s "$ES8_HOST/bordercore/_search?size=0" -H 'Content-Type: application/json' -d '{"query":{"range":{"last_modified":{"gte":"'"$REINDEX_START"'"}}}}' | python3 -c "import sys,json;print(json.load(sys.stdin)['hits']['total'])"`
Expected: a small number (recent edits only).

- [ ] **Step 2: Re-trigger embeddings for that slice**

If `populate-embeddings` / `backfill_image_embeddings` accept a date or uuid filter, use it;
otherwise re-save the affected blobs through the normal index path so the embedding Lambda
fires. Confirm the command/flag by inspecting `bordercore/blob/management/commands/populate-embeddings.py`.
```bash
ELASTICSEARCH_ENDPOINT=$ES8_HOST script -qc '.venv/bin/python bordercore/manage.py populate-embeddings --since "$REINDEX_START"' /dev/null
```
Expected: re-embeds only the changed docs. (If the command has no `--since`, the simplest
safe fallback is to run the final reindex close to cutover so this slice is empty/trivial.)

- [ ] **Step 3: Verify no docs are missing a vector that should have one**

Run a count of `note`-doctype docs lacking `embeddings_vector` and confirm it matches ES7's
same count (some notes legitimately have none):
```bash
for H in $ES7_HOST $ES8_HOST; do curl -s "$H/bordercore/_search?size=0" -H 'Content-Type: application/json' -d '{"query":{"bool":{"must":[{"term":{"doctype":"note"}}],"must_not":[{"exists":{"field":"embeddings_vector"}}]}}}' | python3 -c "import sys,json;print('$H', json.load(sys.stdin)['hits']['total'])"; done
```
Expected: the two counts match.

### Task 5.3: Run the data_quality suite against the new EC2 instance

- [ ] **Step 1: Point the suite at the real ES8 box and run**

Run:
```bash
ELASTICSEARCH_ENDPOINT=$ES8_HOST ELASTICSEARCH_INDEX=bordercore script -qc '.venv/bin/python -m pytest bordercore -v -m data_quality' /dev/null
```
Expected: all data_quality tests PASS (connection, bulk, search, mget, update_by_query, scroll, kNN, ingest-attachment, ESBlob round-trip).

- [ ] **Step 2: Spot-check ingest-attachment on a real binary blob**

Index one PDF blob through the normal path against `$ES8_HOST` and confirm `attachment.content` is populated:
`curl -s "$ES8_HOST/bordercore/_doc/<that-uuid>" | python3 -c "import sys,json;print('attachment' in json.load(sys.stdin)['_source'])"` → `True`.

---

## Phase 6: Cutover

### Task 6.1: Flip the application endpoint

- [ ] **Step 1: Update `ELASTICSEARCH_ENDPOINT` in the app's runtime env**

Set the production env var (wherever the Django app reads it — systemd unit / `.env` / process manager) from `$ES7_HOST` to `$ES8_HOST`. Restart the app.

- [ ] **Step 2: Smoke-test live search**

Run a normal keyword search, a semantic search, an image-similarity search, and a Notes-chip chatbot query through the live UI. Expected: results return, no 500s, semantic results look sane.

### Task 6.2: Redeploy the 4 Lambdas

The thumbnail/index Lambdas carry their own ES client + endpoint and were updated in Task 1.3.

- [ ] **Step 1: Set each Lambda's `ELASTICSEARCH_ENDPOINT` to `$ES8_HOST`**

For each of `index_blobs`, `create_bookmark_thumbnail`, `create_collection_thumbnail`, `create_thumbnail`:
```bash
aws lambda update-function-configuration --function-name <fn> --environment "Variables={ELASTICSEARCH_ENDPOINT=$ES8_HOST,...keep-existing...}"
```
(First read existing env with `aws lambda get-function-configuration` so you don't drop other vars.)

- [ ] **Step 2: Rebuild and deploy each Lambda with the es8 client**

Repackage each Lambda (es8 `requirements.txt` from Task 1.3) and deploy via the project's existing Lambda build/deploy mechanism (zip + `aws lambda update-function-code`, or the Dockerfile/Makefile if one exists under `bordercore/aws/`).

- [ ] **Step 3: Verify a Lambda end-to-end**

Trigger one (e.g. upload a blob to fire `index_blobs`, or create a bookmark to fire `create_bookmark_thumbnail`) and confirm the doc/thumbnail lands in the new ES8 index and CloudWatch shows no connection errors.

### Task 6.3: Soak

- [ ] **Step 1: Watch for 24–48h**

Monitor app logs, Lambda CloudWatch logs, and ES8 `_cluster/health` + JVM heap (`curl -s $ES8_HOST/_nodes/stats/jvm`). Confirm no OOM/circuit-breaker errors on the 2 GB heap. If heap pressure appears, the int8_hnsw quantization + 2 GB heap is the lever already pulled; the fallback within the no-upsize constraint is reducing `num_candidates` or `index.knn` segment merges — note but do not upsize.

---

## Phase 7: Decommission ES7

### Task 7.1: Stop, then later terminate the old instance

- [ ] **Step 1: Stop (don't terminate) the ES7 instance after a clean soak**

Run: `aws ec2 stop-instances --instance-ids i-029f4cd137a6dac2b`
Keep it stopped for a rollback window (e.g. 1–2 weeks). Its data EBS volumes have `DeleteOnTermination: false`, so they survive even a later terminate.

- [ ] **Step 2: Update repo config/docs to reflect ES8**

Update `config/elasticsearch/Dockerfile` base image `7.16.2` → `8.17.1`, fix the stale `elasticsearch.conf.supervisord` (or remove it in favor of the systemd note), and update any README/host references. Commit:
```bash
git add config/elasticsearch/Dockerfile config/elasticsearch/elasticsearch.conf.supervisord
git commit -m "Update ES infra config to 8.17.1 / systemd"
```

- [ ] **Step 3: Terminate after the rollback window**

Run (only once fully confident): `aws ec2 terminate-instances --instance-ids i-029f4cd137a6dac2b`
Decide separately whether to delete or snapshot the freed data volumes.

---

## Rollback

At any point before Task 7.1 Step 3, revert by setting `ELASTICSEARCH_ENDPOINT` back to `$ES7_HOST` for the app and the 4 Lambdas and restarting; ES7 is never mutated during the migration. Code changes (es8 client) are forward-compatible only with ES8 — if rolling back the *server*, also `git revert` the client-bump commits, since the es8 client cannot talk to ES7.

---

## Data strategy (decided)

- **Both local and EC2 load data by remote `_reindex` from ES7**, which carries existing
  `embeddings_vector` / `image_embedding` values — **no OpenAI re-embedding cost**. From-DB
  reindex + full `populate-embeddings` was rejected for cost.
- **Local Docker** gets a real *subset* (all notes + a sample of other doctypes) so the kNN
  relevance check is meaningful (Task 0.2). **EC2** gets the full corpus (Task 5.1).
- Only docs changed during/after the copy get re-embedded (Task 5.2).

## Cross-phase ordering dependencies

- **Both vector mappings must exist before any reindex** or dynamic mapping silently turns
  copied vectors into plain `float` and kNN fails. `embeddings_vector` is in `mappings.json`
  (Task 2.1 makes it indexed); `image_embedding` is applied by the management command. The
  plan applies both before Task 0.2 (local) and Task 5.1 (EC2).
- **Task 2.1 (mapping edit) and Task 1.5 (es8 `put_mapping` fix) are pulled early** — they're
  prerequisites for the local index in Phase 0 even though they're listed in Phases 2/1.
- **Remote reindex networking:** the destination (local Docker container, then the EC2 box)
  makes the outbound call to ES7:9200, so the source IP must be in ES7's SG allowlist, and
  `reindex.remote.whitelist` must list the ES7 host:port on the destination.

## Notes / things to confirm during execution

- **kNN score normalization** is the highest-risk behavior change (Tasks 3.2–3.4). The data_quality range assertions + the relevance check (3.5) are the guardrails; any thresholds get re-derived to the `[0, 1]` scale.
- **`populate-embeddings --since`** (Task 5.2) — confirm the command supports a date/uuid filter; if not, run the final EC2 reindex close to cutover so the changed-doc slice is trivial.
- **Lambda packaging mechanism** isn't pinned in this plan — inspect `bordercore/aws/*/` for an existing build script/Makefile/Dockerfile and follow it (Task 6.2).
- **`perform_search` signature** (Task 3.3 test) — confirm against lines 308-340 before writing the test call.
- **VPC/subnet/keypair/AMI** in Phase 4 must match your existing account; the current instance is in us-east-1c.
```
