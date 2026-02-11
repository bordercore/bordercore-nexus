"""Function-based API endpoints for the search system.

This module contains the JSON/autocomplete endpoints for searching tags,
names, and music via Elasticsearch.
"""

from __future__ import annotations

import datetime
import re
from typing import Any, cast
from urllib.parse import unquote

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request

from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import HttpRequest, JsonResponse

from music.models import Album
from tag.services import get_tag_aliases, get_tag_link

from .helpers import (get_doctype, get_doctypes_from_request, get_link,
                      get_name, is_cached, sort_results)
from .services import (build_base_query, execute_search, get_cover_url,
                       get_elasticsearch_source_fields)

SEARCH_LIMIT = 100


@login_required
def search_tags_and_names(request: HttpRequest) -> JsonResponse:
    """Endpoint for top-search autocomplete matching tags and names.

    Performs parallel searches for matching document names and tags,
    combines the results, sorts them by type, and returns JSON.

    Args:
        request: HTTP request containing:
            - term: Search query string
            - doctype: Optional comma-separated list of document types

    Returns:
        JSON response containing sorted list of matching tags and documents.
    """
    search_term = request.GET["term"].lower()

    doctypes = get_doctypes_from_request(request)

    user = cast(User, request.user)
    matches = search_names_es(user, search_term, doctypes)

    # Add tag search results to the list of matches
    matches.extend(search_tags_es(user, search_term, doctypes))

    return JsonResponse(sort_results(matches), safe=False)


def search_tags_es(user: User, search_term: str, doctypes: list[str]) -> list[dict[str, Any]]:
    """Search Elasticsearch for tags matching the search term.

    Performs a tag autocomplete search and returns matching tag names
    along with their associated document types.

    Args:
        user: The User whose tags to search.
        search_term: The search query string (lowercase).
        doctypes: List of document types to filter by.

    Returns:
        A list of dictionaries, each containing:
            - doctype: "Tag"
            - name: Tag name
            - id: Tag name (same as name)
            - link: URL to search for objects with this tag
    """

    search_object: dict[str, Any] = {
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
            "Distinct Tags": {
                "terms": {
                    "field": "tags.keyword",
                    "size": 1000
                }
            }
        },
        "from_": 0, "size": 100,
        "_source": get_elasticsearch_source_fields()
    }

    if len(doctypes) > 1:
        search_object["query"]["bool"]["must"].append(
            {
                "bool": {
                    "should": [
                        {
                            "term": {
                                "doctype": x
                            }
                        }
                        for x in doctypes
                    ]
                }
            }
        )

    results = execute_search(search_object)

    matches: list[dict[str, Any]] = []
    for tag_result in results["aggregations"]["Distinct Tags"]["buckets"]:
        if tag_result["key"].lower().find(search_term.lower()) != -1:
            matches.insert(0,
                           {
                               "doctype": "Tag",
                               "name": tag_result["key"],
                               "id": tag_result["key"],
                               "link": get_tag_link(tag_result["key"], doctypes)
                           }
                           )

    matches.extend(get_tag_aliases(user, search_term))
    return matches


@login_required
def search_names(request: HttpRequest) -> JsonResponse:
    """Endpoint for searching document names via autocomplete.

    Performs a name-based search with special handling for ngram tokenizer
    limitations: truncates terms to 10 characters and filters out terms
    shorter than 2 characters.

    Args:
        request: HTTP request containing:
            - term: Search query string (URL-encoded)
            - doctype: Optional comma-separated list of document types

    Returns:
        JSON response containing list of matching documents with names,
        dates, UUIDs, and other metadata.
    """
    # Limit each search term to 10 characters, since we've configured the
    # Elasticsearch ngram_tokenizer to only analyze tokens up to that many
    # characters (see mappings.json). Otherwise no results will be returned
    # for longer terms.
    #
    # Remove search terms less than 2 characters in length, since the
    # ngram_tokenizer generates tokens that are 2 characters or longer.
    # Therefore shorter tokens won't generate a match based on the ES query used.
    #
    # Search terms are separated by spaces.
    search_term = unquote(request.GET["term"].lower())
    search_term = " ".join([x[:10] for x in re.split(r"\s+", search_term) if len(x) > 1])

    doctypes = get_doctypes_from_request(request)

    user = cast(User, request.user)
    matches = search_names_es(user, search_term, doctypes)
    return JsonResponse(matches, safe=False)


def search_names_es(user: User, search_term: str, doctypes: list[str]) -> list[dict[str, Any]]:
    """Search Elasticsearch for objects based on name or equivalent fields.

    Performs autocomplete-style search across name, title, artist, and
    question fields. Supports filtering by document type and special
    handling for image and media content types.

    Args:
        user: The User whose objects to search.
        search_term: The search query string.
        doctypes: List of document types to filter by. Special values:
            - "image": Matches content_type "image/*"
            - "media": Matches content_type "image/*" or "video/*"

    Returns:
        A list of dictionaries, each containing:
            - name: Display name for the object
            - date: Formatted date string
            - doctype: Document type
            - note: Optional note field
            - uuid: Object UUID
            - id: Object UUID (same as uuid)
            - important: Importance score
            - url: Object URL
            - link: Detail page URL
            - score: Search relevance score
            - cover_url: Optional cover image URL
            - type: Optional type indicator ("blob" or "bookmark")
    """

    search_object = build_base_query(
        user.id,
        additional_must=[
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
                        },
                        {
                            "match": {
                                "question.autocomplete": {
                                    "query": search_term,
                                    "operator": "and"
                                }
                            }
                        },
                        {
                            "match": {
                                "title.autocomplete": {
                                    "query": search_term,
                                    "operator": "and"
                                }
                            }
                        },
                        {
                            "match": {
                                "artist.autocomplete": {
                                    "query": search_term,
                                    "operator": "and"
                                }
                            }
                        }
                    ]
                }
            }
        ],
        size=SEARCH_LIMIT,
    )
    search_object["highlight"] = {
        "fields": {
            "name.autocomplete": {},
            "artist.autocomplete": {}
        }
    }

    if len(doctypes) > 0:

        if "image" in doctypes:
            # 'image' isn't an official ES doctype, so treat this
            #  as a search for a content type that matches an image.
            doctypes.remove("image")
            search_object["query"]["function_score"]["query"]["bool"]["must"].append(
                {
                    "bool": {
                        "should": [
                            {
                                "wildcard": {
                                    "content_type": {
                                        "value": "image/*",
                                    }
                                }
                            }
                        ]
                    }
                }
            )
        elif "media" in doctypes:
            # 'media' isn't an official ES doctype, so treat this
            #  as a search for a content type that matches either
            #  an image or a video
            doctypes.remove("media")
            search_object["query"]["function_score"]["query"]["bool"]["must"].append(
                {
                    "bool": {
                        "should": [
                            {
                                "wildcard": {
                                    "content_type": {
                                        "value": "image/*",
                                    }
                                }
                            },
                            {
                                "wildcard": {
                                    "content_type": {
                                        "value": "video/*",
                                    }
                                }
                            }
                        ]
                    }
                }
            )

        search_object["query"]["function_score"]["query"]["bool"]["must"].append(
            {
                "bool": {
                    "should": [
                        {
                            "term": {
                                "doctype": x
                            }
                        }
                        for x in doctypes
                    ]
                }
            }
        )

    results = execute_search(search_object)
    matches = []

    cache_checker = is_cached()

    for match in results["hits"]["hits"]:
        doctype_pretty = get_doctype(match)
        name = get_name(doctype_pretty, match["_source"])

        if not cache_checker(doctype_pretty, name):
            if "date_unixtime" in match["_source"] and match["_source"]["date_unixtime"] is not None:
                date = datetime.datetime.fromtimestamp(
                    int(match["_source"]["date_unixtime"])
                ).strftime(
                    "%b %Y"
                )
            else:
                date = ""
            match_dict = {
                "name": name,
                "date": date,
                "doctype": doctype_pretty,
                "note": match["_source"].get("note", ""),
                "uuid": match["_source"].get("uuid"),
                "id": match["_source"].get("uuid"),
                "important": match["_source"].get("importance"),
                "url": match["_source"].get("url", None),
                "link": get_link(doctype_pretty.lower(), match["_source"]),
                "score": match["_score"]
            }
            matches.append(match_dict)

            cover_url = get_cover_url(
                doctype_pretty,
                match["_source"].get("uuid", ""),
                match["_source"].get("filename", ""),
                match["_source"].get("url", ""),
            )
            if cover_url:
                matches[-1]["cover_url"] = cover_url
            if doctype_pretty in ["Blob", "Book", "Document"]:
                matches[-1]["type"] = "blob"
            if doctype_pretty == "Bookmark":
                matches[-1]["type"] = "bookmark"
            if doctype_pretty == "Collection":
                matches[-1]["description"] = match["_source"].get("description", "")

    return matches


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def search_music(request: Request) -> JsonResponse:
    """API endpoint for searching music (songs, artists, albums).

    Performs music-specific searches with support for filtering by artist,
    song title, or album. When searching by album, returns all songs in
    track order.

    Args:
        request: REST framework request containing query parameters:
            - artist: Optional artist name to filter by
            - song: Optional song title to filter by
            - album: Optional album title to filter by

    Returns:
        JSON response containing list of song dictionaries with:
            - artist: Artist name
            - uuid: Song UUID
            - title: Song title
            - track: Optional track number (for album searches)
    """
    limit = 10

    artist = None
    song = None
    album = None

    if "artist" in request.query_params:
        artist = request.query_params["artist"]
    if "song" in request.query_params:
        song = request.query_params["song"]
    if "album" in request.query_params:
        album = request.query_params["album"]

    search_object = build_base_query(
        request.user.id,
        size=limit,
    )

    constraints = search_object["query"]["function_score"]["query"]["bool"]["must"]
    if song:
        constraints.append(
            {
                "bool": {
                    "must": [
                        {
                            "match": {
                                "title.autocomplete": {
                                    "query": song,
                                    "operator": "and"
                                }
                            }
                        },
                        {
                            "term": {
                                "doctype": "song"
                            }
                        }
                    ]
                }
            }
        )
        search_object["query"]["function_score"]["functions"].append({"random_score": {}})
    if artist:
        constraints.append(
            {
                "bool": {
                    "must": [
                        {
                            "match": {
                                "artist.autocomplete": {
                                    "query": artist,
                                    "operator": "and"
                                }
                            }
                        }
                    ]
                }
            }
        )
        search_object["query"]["function_score"]["functions"].append({"random_score": {}})
    if album:
        album_info = Album.objects.filter(title__icontains=album)
        if album_info:
            constraints.append(
                {
                    "bool": {
                        "must": [
                            {
                                "match": {
                                    "album_uuid": {
                                        "query": album_info[0].uuid,
                                        "operator": "and"
                                    }
                                }
                            }
                        ]
                    }
                }
            )
            search_object["sort"] = {"track": {"order": "asc"}}
            search_object["size"] = 1000  # Get all songs from the album

    results = execute_search(search_object)

    return JsonResponse(
        [
            {
                "artist": x["_source"]["artist"],
                "uuid": x["_source"]["uuid"],
                "title": x["_source"]["title"],
                "track": x["_source"].get("track", None)
            }
            for x in results["hits"]["hits"]
        ],
        safe=False
    )
