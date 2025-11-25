"""Django services module for search application.

This module provides service functions for semantic search, document indexing,
and document deletion using Elasticsearch.
"""

from typing import Any, cast

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

    search_object = {
        "query": {
            "function_score": {
                "functions": [
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
                ],
                "query": {
                    "bool": {
                        "must": [
                            {
                                "term": {
                                    "user_id": request.user.id
                                }
                            },
                            {
                                "term": {
                                    "doctype": "note"
                                }
                            }
                        ]
                    }
                }
            }
        },
        "sort": {"_score": {"order": "desc"}},
        "size": 1,
        "_source": [
            "date",
            "contents",
            "doctype",
            "name",
            "title",
            "url",
            "uuid"
        ]
    }

    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)
    try:
        return es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)
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
