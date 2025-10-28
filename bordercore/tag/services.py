"""
Tag Search and Alias Services

This module provides a set of helper functions for retrieving and resolving tag-related
data across multiple application domains such as notes, bookmarks, music, and drills.
It integrates with Elasticsearch to perform efficient substring-based tag searches,
and enriches the results with context-aware metadata and navigation links.

Core capabilities include:
- Searching for tags associated with various document types using autocomplete support.
- Resolving tag aliases to their canonical tags, with optional user-specific context.
- Generating dynamic internal URLs based on tag type and associated content.
- Finding related tags by analyzing co-occurrence patterns in Elasticsearch.
"""

from typing import Any, Dict, List, Optional, Union
from urllib.parse import unquote

from django.conf import settings
from django.contrib.auth.models import User
from django.urls import reverse

from drill.models import Question
from lib.util import get_elasticsearch_connection

from .models import TagAlias

SEARCH_LIMIT = 1000


def get_additional_info(doc_types: List[str], user: User, tag_name: str) -> Dict[str, Any]:
    """
    Return additional information for a given tag based on the document types.

    Args:
        doc_types: List of document types to check against (e.g., 'drill').
        user: The Django user object.
        tag_name: The name of the tag.

    Returns:
        A dictionary containing info and link if applicable.
    """
    if "drill" in doc_types:
        return {
            "info": Question.get_tag_progress(user, tag_name),
            "link": reverse("drill:start_study_session") + f"?study_method=tag&tags={tag_name}"
        }
    return {}


def get_tag_link(tag: str, doc_types: Optional[List[str]] = None) -> str:
    """
    Return the appropriate link URL for a tag depending on its document type.

    Args:
        tag: The tag name.
        doc_types: Optional list of document types.

    Returns:
        A string representing the resolved URL.
    """
    doc_types = doc_types or []

    if "note" in doc_types:
        return reverse("search:notes") + f"?tagsearch={tag}"
    if "bookmark" in doc_types:
        return reverse("bookmark:overview") + f"?tag={tag}"
    if "drill" in doc_types:
        return reverse("drill:start_study_session") + f"?study_method=tag&tags={tag}"
    if "song" in doc_types or "album" in doc_types:
        return reverse("music:search_tag") + f"?tag={tag}"

    return reverse("search:kb_search_tag_detail", kwargs={"taglist": tag})


def get_tag_aliases(user: User, name: str, doc_types: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Find tag aliases that contain the search string and return enriched tag data.

    Args:
        user: The Django user object.
        name: Substring to search for in tag aliases.
        doc_types: Optional list of document types.

    Returns:
        A list of dictionaries with tag alias metadata and additional info.
    """
    doc_types = doc_types or []

    tag_aliases = TagAlias.objects.filter(name__contains=name).select_related("tag")

    # Some fields contain the same value since two different searches call
    #  this method and expect different field names for the same data.
    return [
        {
            "doctype": "Tag",
            "value": x.tag.name,
            "id": f"{x.name} -> {x.tag}",
            "label": f"{x.name} -> {x.tag}",
            "link": get_tag_link(x.tag.name, doc_types),
            **get_additional_info(doc_types, user, x.tag.name)
        }
        for x in
        tag_aliases
    ]


def search(
    user: User,
    tag_name: str,
    doc_types: Optional[List[str]] = None,
    skip_tag_aliases: bool = False
) -> List[Dict[str, Any]]:
    """
    Search for tags matching a given name in Elasticsearch, with optional filtering by document types.

    Args:
        user: The Django user object.
        tag_name: The tag name or substring to search.
        doc_types: Optional list of document types to restrict search to.
        skip_tag_aliases: If True, skip fetching tag aliases.

    Returns:
        A list of matching tag dictionaries.
    """
    doc_types = doc_types or []

    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

    tag_name = tag_name.lower()

    search_term = unquote(tag_name)

    search_object: Dict[str, Any] = {
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
                                        "tags.autocomplete": {
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
        "aggs": {
            "distinct_tags": {
                "terms": {
                    "field": "tags.keyword",
                    "size": SEARCH_LIMIT
                }
            }
        },
        "from_": 0,
        "size": 0,
        "_source": ["tags"]
    }

    # If a doctype list is passed in, then limit our search to tags attached
    #  to those particular object types, rather than to all tags.
    for doc_type in doc_types:
        search_object["query"]["bool"]["must"].append(
            {
                "term": {
                    "doctype": doc_type
                }
            },
        )

    results = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

    matches = []
    for tag_result in results["aggregations"]["distinct_tags"]["buckets"]:
        if tag_result["key"].lower().find(tag_name) != -1:
            matches.append(
                {
                    "label": tag_result["key"],
                    **get_additional_info(doc_types, user, tag_result["key"])
                }
            )

    if not skip_tag_aliases:
        matches.extend(get_tag_aliases(user, search_term, doc_types))

    return matches


def find_related_tags(tag_name: str, user: User, doc_type: Optional[str]) -> List[Dict[str, Union[str, int]]]:
    """
    Find tags that frequently co-occur with the given tag for a specific document type.

    Args:
        tag_name: The base tag name to find related tags for.
        user: The Django user object.
        doc_type: Optional document type to filter on.

    Returns:
        A list of dictionaries containing tag names and their counts.
    """
    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

    tag_name = unquote(tag_name.lower())

    search_object: Dict[str, Any] = {
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
                            "tags.keyword": tag_name
                        }
                    }
                ]
            }
        },
        "aggs": {
            "distinct_tags": {
                "terms": {
                    "field": "tags.keyword",
                }
            }
        },
        "from_": 0,
        "size": 0,
        "_source": ["tags"]
    }

    if doc_type:
        search_object["query"]["bool"]["must"].append(
            {
                "term": {
                    "doctype": doc_type
                }
            }
        )

    results = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

    matches = []
    for tag_result in results["aggregations"]["distinct_tags"]["buckets"]:
        if tag_result["key"] != tag_name:
            matches.append(
                {
                    "tag_name": tag_result["key"],
                    "count": tag_result["doc_count"]
                }
            )

    return matches
