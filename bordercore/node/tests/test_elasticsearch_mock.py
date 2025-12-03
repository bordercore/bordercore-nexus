"""
Unit tests to verify the Elasticsearch mock works correctly for functional tests.

This module tests the mock_es_for_node_test fixture to ensure it properly
mocks Elasticsearch responses for the node list functional test.
"""
import pytest

from blob.tests.factories import BlobFactory
from bookmark.tests.factories import BookmarkFactory


def test_mock_es_returns_recent_items(mock_es_for_node_test, node, bookmark):
    """
    Test that the mock ES returns recent items when no search term is provided.
    """
    # The mock should have pre-populated data from fixtures
    mock_client = mock_es_for_node_test["client"]

    # Simulate a search with no search term (empty query)
    results = mock_client.search(
        index="test",
        query={
            "function_score": {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "term": {
                                    "user_id": node.user.id
                                }
                            }
                        ]
                    }
                }
            }
        }
    )

    # Should return hits
    assert "hits" in results
    assert "hits" in results["hits"]
    assert len(results["hits"]["hits"]) > 0
    # Should return up to 12 recent items
    assert len(results["hits"]["hits"]) <= 12


def test_mock_es_search_by_name(mock_es_for_node_test, node, bookmark):
    """
    Test that the mock ES returns correct results when searching by name.
    """
    mock_client = mock_es_for_node_test["client"]
    user = node.user

    # Create a blob with a unique name
    blob = BlobFactory.create(user=user, name="UniqueTestBlob123")
    mock_es_for_node_test["register_blob"](blob)

    # Search for the blob
    results = mock_client.search(
        index="test",
        query={
            "function_score": {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "term": {
                                    "user_id": user.id
                                }
                            },
                            {
                                "bool": {
                                    "should": [
                                        {
                                            "match": {
                                                "name.autocomplete": {
                                                    "query": "UniqueTest",
                                                    "operator": "and"
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                }
            }
        }
    )

    # Should return the blob we created
    assert len(results["hits"]["hits"]) >= 1
    found = False
    for hit in results["hits"]["hits"]:
        if hit["_source"]["uuid"] == str(blob.uuid):
            found = True
            assert hit["_source"]["name"] == "UniqueTestBlob123"
            break
    assert found, "Created blob should be in search results"


def test_mock_es_filter_by_doctype(mock_es_for_node_test, node, bookmark):
    """
    Test that the mock ES correctly filters by doctype.
    """
    mock_client = mock_es_for_node_test["client"]
    user = node.user

    # Create a blob and bookmark with the same name prefix
    blob = BlobFactory.create(user=user, name="FilterTest123")
    bookmark_obj = BookmarkFactory.create(user=user, name="FilterTest456")

    mock_es_for_node_test["register_blob"](blob)
    mock_es_for_node_test["register_bookmark"](bookmark_obj)

    # Search with bookmark filter
    results = mock_client.search(
        index="test",
        query={
            "function_score": {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "term": {
                                    "user_id": user.id
                                }
                            },
                            {
                                "bool": {
                                    "should": [
                                        {
                                            "match": {
                                                "name.autocomplete": {
                                                    "query": "FilterTest",
                                                    "operator": "and"
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "bool": {
                                    "should": [
                                        {
                                            "term": {
                                                "doctype": "bookmark"
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                }
            }
        }
    )

    # Should only return the bookmark
    assert len(results["hits"]["hits"]) == 1
    assert results["hits"]["hits"][0]["_source"]["doctype"] == "bookmark"
    assert results["hits"]["hits"][0]["_source"]["uuid"] == str(bookmark_obj.uuid)

