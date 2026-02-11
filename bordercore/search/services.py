"""Django services module for search application.

This module provides service functions for semantic search, document indexing,
and document deletion using Elasticsearch.
"""

from typing import Any, cast
from uuid import UUID

from elasticsearch import RequestError, helpers

from django.conf import settings
from django.contrib import messages
from django.http import HttpRequest

from lib.embeddings import len_safe_get_embedding
from lib.util import get_elasticsearch_connection


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
