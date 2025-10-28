"""
Elasticsearch-backed search service for Todo items.

This module defines utilities to query the Elasticsearch index for Todo
documents belonging to a given user and matching a name substring.
"""

import datetime
from typing import Any, Dict, List
from urllib.parse import unquote

from django.conf import settings
from django.contrib.auth.models import User

from lib.util import get_elasticsearch_connection

SEARCH_LIMIT = 1000


def search(user: User, todo_name: str) -> List[Dict[str, Any]]:
    """Search for Todo items in Elasticsearch by name substring.

    Constructs and executes an Elasticsearch query that filters on the given
    user's ID and the "todo" document type, then performs a match on the
    lowercase, unquoted `todo_name` against the `name.autocomplete` field.

    Args:
        user: The Django User instance whose todos to search.
        todo_name: Substring to match against todo names.

    Returns:
        A list of dictionaries, each containing:
            created (datetime.datetime): Parsed creation timestamp.
            name (str): Todo name.
            note (str): Todo note or empty string.
            priority (int): Priority level.
            tags (List[str]): Associated tag names.
            url (str): Related URL or empty string.
            uuid (str): Unique identifier.
    """
    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

    search_term = unquote(todo_name.lower())

    search_object = {
        "query": {
            "bool": {
                "must": [
                    {
                        "term": {
                            "user_id": user.id
                        }
                    },
                    {
                        "term": {
                            "doctype": "todo"
                        }
                    },
                    {
                        "bool": {
                            "should": [
                                {
                                    "match": {
                                        "name.autocomplete": {
                                            "query": search_term,
                                            "operator": "and"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        },
        "from_": 0,
        "size": SEARCH_LIMIT,
        "_source": [
            "date",
            "last_modified",
            "name",
            "note",
            "priority",
            "tags",
            "url",
            "uuid"
        ]
    }

    results = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

    return [
        {
            "created": datetime.datetime.strptime(hit["_source"]["date"]["gte"], "%Y-%m-%d %H:%M:%S"),
            "name": hit["_source"]["name"],
            "note": hit["_source"]["note"],
            "priority": hit["_source"]["priority"],
            "tags": hit["_source"]["tags"],
            "url": hit["_source"]["url"],
            "uuid": hit["_source"]["uuid"],
        }
        for hit in results.get("hits", {}).get("hits", [])
    ]
