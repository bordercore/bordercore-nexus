"""Django services module for search application.

This module provides service functions for semantic search, document indexing,
and document deletion using Elasticsearch.
"""

from __future__ import annotations

import json
import math
import re
from typing import Any, cast
from uuid import UUID

import markdown
import nh3
from elasticsearch import RequestError, helpers

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.models import User
from django.http import HttpRequest, QueryDict

from lib.embeddings import len_safe_get_embedding
from lib.image_search import encode_image_query, encode_text_query
from lib.time_utils import get_date_from_pattern, get_relative_date
from lib.util import get_elasticsearch_connection, get_pagination_range

from .helpers import get_creators, get_link


def get_elasticsearch_source_fields() -> list[str]:
    """Get a list of Elasticsearch _source fields for common search queries.

    Returns a superset of all fields used across multiple search functions.
    It's safe to include fields that some queries don't need, as Elasticsearch
    will simply omit them from results if they're not present in the document.

    Returns:
        A list of field names to include in the Elasticsearch _source parameter.
    """
    return [
        "album",
        "album_id",
        "album_uuid",
        "artist",
        "artist_uuid",
        "author",
        "bordercore_id",
        "content_type",
        "contents",
        "date",
        "date_unixtime",
        "doctype",
        "filename",
        "importance",
        "last_modified",
        "name",
        "note",
        "question",
        "sha1sum",
        "tags",
        "title",
        "track",
        "url",
        "uuid",
    ]


def build_base_query(
    user_id: int,
    *,
    additional_must: list[dict[str, Any]] | None = None,
    size: int = 10,
    offset: int = 0,
    source_fields: list[str] | None = None,
) -> dict[str, Any]:
    """Construct the common function_score query skeleton.

    Builds a ``function_score`` query filtered by ``user_id`` with the
    standard ``field_value_factor`` on ``importance``.  Callers can append
    their own clauses to the returned ``must`` list or replace
    ``functions`` for custom scoring.

    Args:
        user_id: The user whose documents to search.
        additional_must: Extra clauses to add to the bool/must list.
        size: Number of results to return.
        offset: Starting offset (``from_``).
        source_fields: ``_source`` field list.  Defaults to
            :func:`get_elasticsearch_source_fields`.

    Returns:
        A mutable Elasticsearch query dict ready for further customisation.
    """
    must: list[dict[str, Any]] = [{"term": {"user_id": user_id}}]
    if additional_must:
        must.extend(additional_must)

    return {
        "query": {
            "function_score": {
                "functions": [
                    {
                        "field_value_factor": {
                            "field": "importance",
                            "missing": 1
                        }
                    }
                ],
                "query": {
                    "bool": {
                        "must": must
                    }
                }
            }
        },
        "from_": offset,
        "size": size,
        "_source": source_fields if source_fields is not None else get_elasticsearch_source_fields(),
    }


def execute_search(
    search_object: dict[str, Any],
    timeout: int | None = None,
) -> dict[str, Any]:
    """Execute an Elasticsearch search.

    Wraps the repeated ``get_elasticsearch_connection`` +
    ``es.search`` two-liner.  Error handling (e.g. ``RequestError``)
    stays in callers since each handles it differently.

    Args:
        search_object: The Elasticsearch query dict (passed as
            ``**kwargs`` to ``es.search``).
        timeout: Optional connection timeout in seconds.

    Returns:
        The raw Elasticsearch response dict.
    """
    kwargs: dict[str, Any] = {"host": settings.ELASTICSEARCH_ENDPOINT}
    if timeout is not None:
        kwargs["timeout"] = timeout
    es = get_elasticsearch_connection(**kwargs)
    return es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)


def get_cover_url(
    doctype: str | None,
    uuid: str,
    filename: str = "",
    url: str = "",
) -> str | None:
    """Return the cover/thumbnail URL for a search result.

    Consolidates the cover URL logic that was duplicated across
    ``SearchListView``, ``SearchTagDetailView``, and
    ``search_names_es``.

    Args:
        doctype: Document type (case-insensitive).
        uuid: Object UUID.
        filename: Filename (used for blob-like types).
        url: Original URL (used for bookmarks).

    Returns:
        The cover URL string, or ``None`` if the doctype has no cover.
    """
    # Import here to avoid circular import (blob.models → collection.models → search.services)
    from blob.models import Blob
    from bookmark.models import Bookmark

    dt = (doctype or "").lower()
    if dt in ("blob", "book", "document"):
        return Blob.get_cover_url_static(UUID(uuid), filename, size="small")
    if dt == "bookmark":
        return Bookmark.thumbnail_url_static(uuid, url)
    if dt == "collection":
        return f"{settings.COVER_URL}collections/{uuid}.jpg"
    return None


# Notes RAG hybrid retrieval: BM25 + kNN fused with Python-side Reciprocal Rank
# Fusion (the native ES rrf retriever requires a Platinum license; the cluster
# is basic). Each doc's fused score is sum(1 / (rank_constant + rank)).
NOTES_RRF_RANK_CONSTANT = 60
NOTES_RRF_RANK_WINDOW = 50
NOTES_BM25_FIELDS = ["name^2", "contents"]
NOTES_PASSAGE_FALLBACK_CHARS = 1500

RESULT_COUNT_PER_PAGE = 10

SOURCE_FIELDS = [
    "album_uuid",
    "artist",
    "artist_uuid",
    "author",
    "bordercore_id",
    "date",
    "date_unixtime",
    "description",
    "doctype",
    "filename",
    "importance",
    "last_modified",
    "metadata.*",
    "name",
    "question",
    "sha1sum",
    "tags",
    "title",
    "url",
    "uuid",
]


def _build_pagination_dict(page: int, num_results: int) -> dict[str, Any]:
    """Build pagination data dictionary for search results.

    Args:
        page: The current page number (1-indexed).
        num_results: Total number of search results.

    Returns:
        A dictionary containing pagination information (page_number,
        num_pages, total_results, range, has_previous, has_next, etc.),
        or an empty dict if num_results is 0.
    """
    if num_results == 0:
        return {}

    num_pages = int(math.ceil(num_results / RESULT_COUNT_PER_PAGE))
    pagination_window = 2

    paginator: dict[str, Any] = {
        "page_number": page,
        "num_pages": num_pages,
        "total_results": num_results,
        "range": get_pagination_range(page, num_pages, pagination_window),
    }
    paginator["has_previous"] = page != 1
    paginator["has_next"] = page != paginator["num_pages"]
    paginator["previous_page_number"] = page - 1
    paginator["next_page_number"] = page + 1
    return paginator


def _get_aggregations(es_results: dict[str, Any], aggregation: str) -> list[dict[str, Any]]:
    """Extract aggregation data from Elasticsearch results.

    Args:
        es_results: Raw Elasticsearch response dictionary containing
            an ``aggregations`` key.
        aggregation: The name of the aggregation to extract (e.g.
            ``"Doctype Filter"``).

    Returns:
        A list of dicts, each with ``doctype`` (bucket key) and
        ``count`` (doc_count).
    """
    return [
        {"doctype": bucket["key"], "count": bucket["doc_count"]}
        for bucket in es_results["aggregations"][aggregation]["buckets"]
    ]


def _filter_results(results: list[dict[str, Any]], search_term: str | None) -> None:
    """Process and enrich search results in-place for display.

    Renames ES internal keys (``_source`` → ``source``, ``_score`` →
    ``score``), adds computed fields (creators, formatted dates, URLs,
    cover images, tags JSON), and renders markdown for drill/todo items.

    Args:
        results: List of raw Elasticsearch hit dictionaries. Modified
            in-place.
        search_term: The user's search query string, or ``None`` if no
            text search was performed. Used to highlight matched terms
            in content fields.
    """
    for match in results:
        match["source"] = match.pop("_source")
        match["score"] = match.pop("_score")

        # last_modified and doctype may be absent from a document (ES omits
        # fields that aren't set), so read them with .get() to avoid a KeyError
        # that would surface as a 500 on the search endpoint.
        doctype = match["source"].get("doctype")
        match["source"]["creators"] = get_creators(match["source"])
        match["source"]["date"] = get_date_from_pattern(match["source"].get("date", None))
        match["source"]["last_modified"] = get_relative_date(match["source"].get("last_modified"))
        match["source"]["url"] = get_link(doctype, match["source"])

        cover_url = get_cover_url(
            doctype,
            match["source"].get("uuid", ""),
            match["source"].get("filename", ""),
        )
        if cover_url:
            match["source"]["cover_url"] = cover_url

        match["tags_json"] = (
            json.dumps(match["source"]["tags"])
            if "tags" in match["source"]
            else "[]"
        )

        if "highlight" in match and "attachment.content" in match["highlight"]:
            match["highlight"]["attachment_content"] = match["highlight"].pop("attachment.content")

        if search_term and "contents" in match["source"]:
            # Highlight matches case-insensitively and on word boundaries so we
            # don't miss differently-cased hits or italicize a fragment inside a
            # larger word. The matched text's original case is preserved.
            # (ES highlight fragments would handle tokenized/multi-term queries
            # more precisely, but this avoids corrupting the displayed content.)
            pattern = re.compile(rf"\b{re.escape(search_term)}\b", re.IGNORECASE)
            match["source"]["contents"] = pattern.sub(
                lambda m: f"*{m.group(0)}*", match["source"]["contents"]
            )

        if doctype == "drill":
            match["source"]["question"] = nh3.clean(markdown.markdown(match["source"]["question"]))
        if doctype == "todo":
            match["source"]["name"] = nh3.clean(markdown.markdown(match["source"]["name"]))


def perform_search(
    user: User,
    params: QueryDict,
    *,
    is_semantic: bool = False,
) -> dict[str, Any]:
    """Execute a search and return results ready for JSON serialization.

    This is the single source of truth for the search page — used by both
    the server-rendered view and the JSON API endpoint.

    Args:
        user: The authenticated user performing the search.
        params: Query parameters (typically ``request.GET``). Recognised
            keys: ``term_search``, ``search``, ``semantic_search``,
            ``sort``, ``boolean_search_type``, ``doctype``, ``page``,
            ``exact_match``, ``tags``.
        is_semantic: When ``True``, use cosine-similarity scoring
            against the ``semantic_search`` parameter instead of
            text matching.

    Returns:
        A dict with keys ``results`` (list of enriched hits),
        ``aggregations`` (doctype counts), ``paginator`` (pagination
        metadata), and ``count`` (total hit count).
    """
    from .models import RecentSearch

    search_term = params.get("term_search") or params.get("search")
    sort_field = params.get("sort", "date_unixtime")
    boolean_type = params.get("boolean_search_type", "AND")
    doctype = params.get("doctype") or None
    page = int(params.get("page", 1))

    if search_term:
        RecentSearch.add(user, search_term)

    # Store sort preference
    offset = (page - 1) * RESULT_COUNT_PER_PAGE

    search_object = build_base_query(
        cast(int, user.id),
        size=RESULT_COUNT_PER_PAGE,
        offset=offset,
        source_fields=SOURCE_FIELDS,
    )
    search_object["aggs"] = {
        "Doctype Filter": {
            "terms": {
                "field": "doctype",
                "size": 10,
            }
        }
    }
    search_object["highlight"] = {
        "fields": {
            "attachment.content": {},
            "contents": {},
        },
        "number_of_fragments": 1,
        "fragment_size": 200,
        "order": "score",
    }
    search_object["sort"] = {sort_field: {"order": "desc"}}

    if is_semantic:
        # Native ES8 kNN over embeddings_vector (scores in [0, 1]). kNN is a
        # top-level search param with its own filter, so the function_score
        # skeleton and post_filter are dropped here; user/tag/doctype constraints
        # move into knn.filter. `k` covers the requested page so pagination via
        # from_/size still works.
        semantic_term = params.get("semantic_search", "")
        embeddings = len_safe_get_embedding(semantic_term)
        knn_filter: list[dict[str, Any]] = [{"term": {"user_id": cast(int, user.id)}}]
        for tag in params.getlist("tags"):
            knn_filter.append({"term": {"tags.keyword": tag}})
        if doctype:
            knn_filter.append({"term": {"doctype": doctype}})

        page_k = offset + RESULT_COUNT_PER_PAGE
        search_object.pop("query", None)
        search_object.pop("post_filter", None)
        search_object["knn"] = {
            "field": "embeddings_vector",
            "query_vector": embeddings,
            "k": page_k,
            "num_candidates": max(200, page_k * 5),
            "filter": knn_filter,
        }
        search_object["sort"] = {"_score": {"order": "desc"}}
    else:
        # Doctype post-filter
        if doctype:
            search_object["post_filter"] = {"term": {"doctype": doctype}}

        # Tag filters
        filter_tags = params.getlist("tags")
        if filter_tags:
            for tag in filter_tags:
                search_object["query"]["function_score"]["query"]["bool"]["must"].append(
                    {"term": {"tags.keyword": tag}}
                )

        # Text query
        if search_term:
            search_object["query"]["function_score"]["query"]["bool"]["must"].append(
                {
                    "multi_match": {
                        "type": "phrase" if params.get("exact_match") == "Yes" else "best_fields",
                        "query": search_term,
                        "fields": [
                            "answer",
                            "metadata.*",
                            "attachment.content",
                            "contents",
                            "description",
                            "name",
                            "question",
                            "sha1sum",
                            "title",
                            "uuid",
                        ],
                        "operator": boolean_type,
                    }
                }
            )

    try:
        es_results = execute_search(search_object, timeout=40)
    except RequestError:
        return {"results": [], "aggregations": [], "paginator": {}, "count": 0}

    _filter_results(es_results["hits"]["hits"], search_term)

    aggregations = _get_aggregations(es_results, "Doctype Filter")
    total = es_results["hits"]["total"]["value"]
    paginator = _build_pagination_dict(page, total)

    return {
        "results": es_results["hits"]["hits"],
        "aggregations": aggregations,
        "paginator": paginator,
        "count": total,
    }


def find_similar_images(
    user_id: int,
    *,
    blob_uuid: str | None = None,
    image_bytes: bytes | None = None,
    text: str | None = None,
    threshold: float = 0.6,
    limit: int = 30,
) -> list[tuple[str, float]]:
    """Return ranked (uuid, similarity) pairs for image similarity queries.

    Exactly one of ``blob_uuid``, ``image_bytes``, or ``text`` must be
    provided.

    ``threshold`` is a cosine-similarity floor in [0, 1] (0.5 means
    "weakly similar"; 0.95 means "near-duplicate"). Returned similarity
    values are in [0, 1] — ES 8 native cosine kNN scores as
    ``(1 + cosineSimilarity) / 2``.

    For ``blob_uuid`` mode, the query vector is pulled directly from the
    existing ES document — no Lambda call is needed. The source blob is
    excluded from the results. For ``image_bytes`` and ``text`` modes the
    input is forwarded to the CreateImageEmbedding Lambda for encoding.

    The ``user_id`` filter mirrors the existing search in
    ``build_search_object``, which scopes every ES query to a single
    owner via ``{"term": {"user_id": …}}``.

    Args:
        user_id: ID of the user whose blobs to search.
        blob_uuid: UUID of an existing blob whose stored embedding to use
            as the query vector.
        image_bytes: Raw bytes of a query image (JPEG, PNG, …).
        text: Free-text query describing the desired image.
        threshold: Minimum cosine similarity (inclusive) for a hit to be
            included in the results.
        limit: Maximum number of results to return.

    Returns:
        List of ``(blob_uuid, similarity)`` tuples, ranked by ES score
        (highest first). Only hits at or above ``threshold`` are included.

    Raises:
        ValueError: If not exactly one of blob_uuid / image_bytes / text
            is given, or if the referenced blob has no stored embedding.
    """
    provided = [x for x in (blob_uuid, image_bytes, text) if x is not None]
    if len(provided) != 1:
        raise ValueError("Provide exactly one of blob_uuid, image_bytes, text")

    es = get_elasticsearch_connection()
    index = settings.ELASTICSEARCH_INDEX

    if blob_uuid is not None:
        doc = es.get(
            index=index, id=blob_uuid, _source_includes=["image_embedding"]
        )
        vector = doc["_source"].get("image_embedding")
        if vector is None:
            raise ValueError(f"Blob {blob_uuid} has no image_embedding stored")
    elif image_bytes is not None:
        vector = encode_image_query(image_bytes)
    else:
        assert text is not None  # enforced by the provided-count check above
        vector = encode_text_query(text)

    # kNN only scores docs that have the vector, so no explicit exists clause.
    filter_clauses: list[dict] = [{"term": {"user_id": user_id}}]
    if blob_uuid is not None:
        filter_clauses.append(
            {"bool": {"must_not": {"term": {"uuid": blob_uuid}}}}
        )

    knn_query: dict[str, Any] = {
        "field": "image_embedding",
        "query_vector": vector,
        "k": limit,
        "num_candidates": max(limit * 10, 100),
        "filter": filter_clauses,
    }

    response = es.search(index=index, knn=knn_query, size=limit, source=False)
    out: list[tuple[str, float]] = []
    for hit in response["hits"]["hits"]:
        # Native cosine kNN already returns (1 + cosine) / 2 in [0, 1].
        similarity = hit["_score"]
        if similarity >= threshold:
            out.append((hit["_id"], similarity))
    return out


def perform_image_search(
    user: User,
    *,
    image_bytes: bytes | None = None,
    text: str | None = None,
) -> dict[str, Any]:
    """Run an image-similarity search and return enriched results.

    Encodes the query (image bytes or text description) via the
    CreateImageEmbedding Lambda, queries Elasticsearch for similar blobs,
    fetches the full source documents for each hit, and enriches them with
    the same fields that ``perform_search`` produces.

    Args:
        user: The authenticated user performing the search.
        image_bytes: Raw bytes of a query image.
        text: Free-text description of the desired image.

    Returns:
        A dict with ``results`` (list of enriched hits), ``aggregations``
        (empty list — image search has no facets), ``paginator``
        (single-page dict), and ``count`` (number of hits).

    Raises:
        ValueError: If neither or both of ``image_bytes`` / ``text`` are given,
            or if the underlying similarity service raises.
        RuntimeError: If the embedding Lambda is unavailable.
    """
    uuid_similarity_pairs = find_similar_images(
        user_id=cast(int, user.id),
        image_bytes=image_bytes,
        text=text,
        threshold=0.0,
        limit=30,
    )

    if not uuid_similarity_pairs:
        return {"results": [], "aggregations": [], "paginator": {}, "count": 0}

    uuids = [pair[0] for pair in uuid_similarity_pairs]
    similarity_map = {pair[0]: pair[1] for pair in uuid_similarity_pairs}

    es = get_elasticsearch_connection()
    index = settings.ELASTICSEARCH_INDEX
    mget_response = es.mget(index=index, ids=uuids)

    hits = []
    for doc in mget_response["docs"]:
        if not doc.get("found"):
            continue
        source = doc["_source"]
        # Only surface blobs belonging to this user (mget doesn't filter)
        if source.get("user_id") != user.id:
            continue
        blob_uuid = doc["_id"]
        hits.append({
            "_source": source,
            "_score": similarity_map.get(blob_uuid, 0.0),
            "_id": blob_uuid,
            "highlight": {},
        })

    # Preserve the similarity ordering from find_similar_images
    uuid_order = {u: i for i, u in enumerate(uuids)}
    hits.sort(key=lambda h: uuid_order.get(h["_id"], len(uuids)))

    _filter_results(hits, None)

    count = len(hits)
    paginator = _build_pagination_dict(1, count) if count > 0 else {}

    return {
        "results": hits,
        "aggregations": [],
        "paginator": paginator,
        "count": count,
    }


def _rrf_fuse(
    hit_lists: list[list[dict[str, Any]]],
    *,
    rank_constant: int = NOTES_RRF_RANK_CONSTANT,
) -> list[dict[str, Any]]:
    """Fuse multiple ranked Elasticsearch hit lists via Reciprocal Rank Fusion.

    Each document's fused score is the sum over the input lists of
    ``1 / (rank_constant + rank)`` (1-based rank within each list). Documents are
    keyed by ``_id``; the returned hit dicts are the first-seen copy for each id
    with ``_score`` replaced by the fused score, sorted by fused score descending.
    On equal fused scores, documents keep first-seen insertion order (i.e. the
    order the input lists were passed — earlier lists take precedence), because
    Python's ``sorted`` is stable over the underlying dict insertion order.
    """
    fused_scores: dict[str, float] = {}
    hit_by_id: dict[str, dict[str, Any]] = {}
    for hits in hit_lists:
        for rank, hit in enumerate(hits, start=1):
            doc_id = hit["_id"]
            fused_scores[doc_id] = fused_scores.get(doc_id, 0.0) + 1.0 / (rank_constant + rank)
            hit_by_id.setdefault(doc_id, hit)
    ranked_ids = sorted(fused_scores, key=lambda d: fused_scores[d], reverse=True)
    fused: list[dict[str, Any]] = []
    for doc_id in ranked_ids:
        hit = dict(hit_by_id[doc_id])
        hit["_score"] = fused_scores[doc_id]
        fused.append(hit)
    return fused


def _knn_chunk_passage(hit: dict[str, Any]) -> str | None:
    """Return the matched nested chunk text from a kNN hit's inner_hits, if any."""
    try:
        inner = hit["inner_hits"]["chunks"]["hits"]["hits"]
    except (KeyError, TypeError):
        return None
    if not inner:
        return None
    return inner[0].get("_source", {}).get("text")


def _bm25_highlight_passage(hit: dict[str, Any]) -> str | None:
    """Return the first highlight fragment on ``contents`` from a BM25 hit, if any."""
    fragments = hit.get("highlight", {}).get("contents")
    return fragments[0] if fragments else None


def semantic_search(
    request: HttpRequest,
    search: str,
    *,
    size: int = 8,
) -> dict[str, Any]:
    """Perform hybrid BM25 + kNN search over the user's notes, fused with Python-side Reciprocal Rank Fusion.

    Runs a BM25 multi_match query and a kNN semantic query separately, then
    merges their rankings using Python-side RRF. Both sub-queries are filtered
    to the requesting user's notes. The native ES RRF retriever is not used
    because it requires a Platinum license; the cluster runs a basic license.

    Args:
        request: The HTTP request object containing the authenticated user.
        search: The search query string to generate embeddings from.
        size: Maximum number of note hits to return, ranked by fused RRF score.

    Returns:
        An Elasticsearch-style result dict with ``hits.hits`` (list of hit
        dicts) and ``hits.total.value`` (count of unique docs fused across
        both retrieval windows). Each hit carries a ``_passage`` key — the
        best available generation passage: the matched nested chunk text (from
        kNN inner_hits), the first BM25 highlight fragment, or the first
        ``NOTES_PASSAGE_FALLBACK_CHARS`` characters of ``contents``. The
        ``_score`` on each hit is an RRF fused value, not a cosine similarity,
        so callers must not apply a cosine threshold to the results. On a
        ``RequestError``, an error message is added to the request and the
        function returns ``{"hits": {"hits": [], "total": {"value": 0}}}``,
        an empty result set.
    """

    embeddings = len_safe_get_embedding(search)
    user_id = cast(int, request.user.id)

    # Both sub-queries are scoped to the user's notes.
    note_filter = [
        {"term": {"user_id": user_id}},
        {"term": {"doctype": "note"}},
    ]
    source_fields = ["date", "contents", "doctype", "name", "title", "url", "uuid"]

    # BM25 (lexical / exact-term) over name + body, with a highlight fragment
    # used as the generation passage for lexically-matched notes.
    bm25_search: dict[str, Any] = {
        "query": {
            "bool": {
                "must": [
                    {"multi_match": {"query": search, "fields": NOTES_BM25_FIELDS}}
                ],
                "filter": note_filter,
            }
        },
        "size": NOTES_RRF_RANK_WINDOW,
        "_source": source_fields,
        "highlight": {
            "fields": {"contents": {"fragment_size": 600, "number_of_fragments": 1}}
        },
    }
    # kNN (semantic) over the nested per-chunk vectors; inner_hits returns the
    # best-matching chunk so its text can be the generation passage.
    knn_search: dict[str, Any] = {
        "knn": {
            "field": "chunks.vector",
            "query_vector": embeddings,
            "k": NOTES_RRF_RANK_WINDOW,
            "num_candidates": max(NOTES_RRF_RANK_WINDOW * 2, 100),
            "filter": note_filter,
            "inner_hits": {"name": "chunks", "size": 1, "_source": ["text"]},
        },
        "size": NOTES_RRF_RANK_WINDOW,
        "_source": source_fields,
    }

    try:
        bm25_hits = execute_search(bm25_search)["hits"]["hits"]
        knn_hits = execute_search(knn_search)["hits"]["hits"]
    except RequestError as e:
        error_info = cast(dict[str, Any], e.info)
        messages.add_message(request, messages.ERROR, f"Request Error: {e.status_code} {error_info.get('error')}")
        return {"hits": {"hits": [], "total": {"value": 0}}}

    # Best passage per note: matched chunk (kNN) > highlight fragment (BM25).
    passage_by_id: dict[str, str] = {}
    for hit in knn_hits:
        chunk = _knn_chunk_passage(hit)
        if chunk:
            passage_by_id[hit["_id"]] = chunk
    for hit in bm25_hits:
        if hit["_id"] not in passage_by_id:
            fragment = _bm25_highlight_passage(hit)
            if fragment:
                passage_by_id[hit["_id"]] = fragment

    fused = _rrf_fuse([bm25_hits, knn_hits])
    top = fused[:size]
    for hit in top:
        passage = passage_by_id.get(hit["_id"])
        if not passage:
            passage = (hit.get("_source", {}).get("contents") or "")[:NOTES_PASSAGE_FALLBACK_CHARS]
        hit["_passage"] = passage
    # total = count of unique docs fused across both windows, not a corpus match count.
    return {"hits": {"hits": top, "total": {"value": len(fused)}}}


def index_document(doc: dict[str, Any]) -> None:
    """Index a document in Elasticsearch.

    This function is the application-wide entry point for indexing a document.
    It delegates to the internal implementation, allowing for mocking or
    swapping out the underlying behavior in tests or alternate environments.

    Args:
        doc: A dictionary representing the Elasticsearch document. This
            must contain the required keys for the bulk API, such as "_index",
            "_id", and "_source".

    Raises:
        elasticsearch.ElasticsearchException: If the underlying indexing fails.
    """
    _index_document(doc)


def _index_document(doc: dict[str, Any]) -> None:
    """Actual implementation of Elasticsearch document indexing.

    This function performs the real Elasticsearch call using the `helpers.bulk`
    API. It should not be used directly outside this module; use `index_document`
    instead to preserve testability and abstraction.

    Args:
        doc: The document to index, conforming to the Elasticsearch bulk
            helper format.

    Raises:
        elasticsearch.ElasticsearchException: If the indexing operation fails.
    """
    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)
    helpers.bulk(es, [doc])


def delete_document(doc_id: str) -> None:
    """Delete a document from Elasticsearch by ID.

    This function is the application-wide entry point for deleting a document.
    It delegates to the internal implementation, allowing for mocking or
    swapping out the underlying behavior in tests or alternate environments.

    Args:
        doc_id: The unique identifier of the document to delete.

    Raises:
        elasticsearch.ElasticsearchException: If the deletion operation fails.
    """
    _delete_document(doc_id)


def _delete_document(doc_id: str) -> None:
    """Actual implementation of Elasticsearch document deletion

    This function performs the real Elasticsearch call. It should not be used
    directly outside this module; use `delete_document` instead to preserve
    testability and abstraction.

    Args:
        doc_id: The unique identifier of the document to delete.

    Raises:
        elasticsearch.ElasticsearchException: If the deletion operation fails.
    """
    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)
    es.delete(index=settings.ELASTICSEARCH_INDEX, id=doc_id)
