"""Django services module for search application.

This module provides service functions for semantic search, document indexing,
and document deletion using Elasticsearch.
"""

from __future__ import annotations

import json
import math
from typing import Any, cast
from uuid import UUID

import markdown
from elasticsearch import RequestError, helpers

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.models import User
from django.http import HttpRequest, QueryDict

from lib.embeddings import len_safe_get_embedding
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
    doctype: str,
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

    dt = doctype.lower()
    if dt in ("blob", "book", "document"):
        return Blob.get_cover_url_static(UUID(uuid), filename, size="small")
    if dt == "bookmark":
        return Bookmark.thumbnail_url_static(uuid, url)
    if dt == "collection":
        return f"{settings.COVER_URL}collections/{uuid}.jpg"
    return None


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
    paginate_by = 2

    paginator: dict[str, Any] = {
        "page_number": page,
        "num_pages": num_pages,
        "total_results": num_results,
        "range": get_pagination_range(page, num_pages, paginate_by),
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

        match["source"]["creators"] = get_creators(match["source"])
        match["source"]["date"] = get_date_from_pattern(match["source"].get("date", None))
        match["source"]["last_modified"] = get_relative_date(match["source"]["last_modified"])
        match["source"]["url"] = get_link(match["source"]["doctype"], match["source"])

        cover_url = get_cover_url(
            match["source"]["doctype"],
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
            match["source"]["contents"] = match["source"]["contents"].replace(search_term, f"*{search_term}*")

        if match["source"]["doctype"] == "drill":
            match["source"]["question"] = markdown.markdown(match["source"]["question"])
        if match["source"]["doctype"] == "todo":
            match["source"]["name"] = markdown.markdown(match["source"]["name"])


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

    # Semantic search: replace scoring with cosine similarity
    if is_semantic:
        semantic_term = params.get("semantic_search", "")
        embeddings = len_safe_get_embedding(semantic_term)
        search_object["sort"] = {"_score": {"order": "desc"}}
        search_object["query"]["function_score"]["functions"] = [
            {
                "script_score": {
                    "script": {
                        "source": "doc['embeddings_vector'].size() == 0 ? 0 : cosineSimilarity(params.query_vector, 'embeddings_vector') + 1.0",
                        "params": {"query_vector": embeddings},
                    }
                }
            }
        ]

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

    # Text query (skip for semantic-only searches)
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


def semantic_search(request: HttpRequest, search: str) -> dict[str, Any]:
    """Perform semantic search using embeddings and Elasticsearch.

    Searches for notes using cosine similarity between the query embedding
    and document embeddings. Results are filtered by user and limited to
    note document types, returning the top match.

    Args:
        request: The HTTP request object containing the authenticated user.
        search: The search query string to generate embeddings from.

    Returns:
        A dictionary containing Elasticsearch search results with hits,
        aggregations, and metadata, or an empty list if a RequestError occurs.
        If a RequestError occurs, an error message is added to the request
        and an empty list is returned (the exception is caught and handled).
    """

    embeddings = len_safe_get_embedding(search)

    search_object = build_base_query(
        cast(int, request.user.id),
        additional_must=[{"term": {"doctype": "note"}}],
        size=1,
        source_fields=[
            "date",
            "contents",
            "doctype",
            "name",
            "title",
            "url",
            "uuid"
        ],
    )

    search_object["query"]["function_score"]["functions"] = [
        {
            "script_score": {
                "script": {
                    "source": "doc['embeddings_vector'].size() == 0 ? 0 : cosineSimilarity(params.query_vector, 'embeddings_vector') + 1.0",
                    "params": {
                        "query_vector": embeddings
                    }
                }
            }
        }
    ]
    search_object["sort"] = {"_score": {"order": "desc"}}

    try:
        return execute_search(search_object)
    except RequestError as e:
        error_info = cast(dict[str, Any], e.info)
        messages.add_message(request, messages.ERROR, f"Request Error: {e.status_code} {error_info.get('error')}")
        return {"hits": {"hits": [], "total": {"value": 0}}}


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
