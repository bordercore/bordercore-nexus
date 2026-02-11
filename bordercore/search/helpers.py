"""Pure helper functions for the search system.

This module contains utility functions that don't make Elasticsearch client
calls or contain view logic. They handle result formatting, URL generation,
document type mapping, and deduplication.
"""

from __future__ import annotations

from typing import Any

from django.http import HttpRequest
from django.urls import reverse


def get_creators(matches: dict[str, Any]) -> str:
    """Return all "creator" related fields from a match result.

    Extracts author, artist, and photographer fields from the metadata
    and returns them as a comma-separated string.

    Args:
        matches: A dictionary containing search result data, expected to
            have a "metadata" key with creator-related fields.

    Returns:
        A comma-separated string of creator names, or empty string if
        no metadata or creators are found.
    """

    if "metadata" not in matches:
        return ""

    creators = [
        matches["metadata"][x][0]
        for x
        in matches["metadata"].keys()
        if x in ["author", "artist", "photographer"]
    ]

    return ", ".join(creators)


def sort_results(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sort search results by document type in a predefined order.

    Organizes matches into categories by document type, then returns them
    in a specific order with category headers (splitters) inserted between
    each type group.

    Args:
        matches: List of search result dictionaries, each containing a
            "doctype" key.

    Returns:
        A list of result dictionaries, with category splitter dictionaries
        inserted between each document type group. Splitters have:
            - id: "__{Type}"
            - name: "{Type}s"
            - splitter: True
    """
    # These categories are sorted according to importance and define
    #  the order matches appear in the search results
    types: dict[str, list] = {
        "Tag": [],
        "Artist": [],
        "Song": [],
        "Album": [],
        "Book": [],
        "Drill": [],
        "Note": [],
        "Bookmark": [],
        "Document": [],
        "Blob": [],
        "Todo": [],
        "Collection": []
    }

    for match in matches:
        types[match["doctype"]].append(match)

    # Remove empty categories
    result = {key: value for (key, value) in types.items() if len(value) > 0}

    response = []
    for key, _ in result.items():
        response.extend(
            [
                {
                    "id": f"__{key}",
                    "name": f"{key}s",
                    "splitter": True,
                },
                *result[key]
            ]
        )

    return response


def get_link(doctype: str, match: dict[str, Any]) -> str:
    """Generate a URL for a document based on its type.

    Args:
        doctype: The document type (e.g., "bookmark", "song", "album").
        match: Dictionary containing document data, including uuid and
            other type-specific fields.

    Returns:
        A URL string pointing to the detail page for the document, or
        empty string if the type is not recognized.
    """
    url = ""

    if doctype == "bookmark":
        url = match["url"]
    elif doctype == "song":
        if "album_uuid" in match:
            url = reverse("music:album_detail", kwargs={"uuid": match["album_uuid"]})
        else:
            url = reverse("music:artist_detail", kwargs={"uuid": match["artist_uuid"]})
    elif doctype == "album":
        url = reverse("music:album_detail", kwargs={"uuid": match["uuid"]})
    elif doctype == "artist":
        url = reverse("music:artist_detail", kwargs={"uuid": match["artist_uuid"]})
    elif doctype in ("blob", "book", "document", "note"):
        url = reverse("blob:detail", kwargs={"uuid": match["uuid"]})
    elif doctype == "drill":
        url = reverse("drill:detail", kwargs={"uuid": match["uuid"]})
    elif doctype == "todo":
        url = reverse("todo:detail", kwargs={"uuid": match["uuid"]})
    elif doctype == "collection":
        url = reverse("collection:detail", kwargs={"uuid": match["uuid"]})

    return url


def get_name(doctype: str, match: dict[str, Any]) -> str:
    """Extract a display name for a document based on its type.

    Args:
        doctype: The document type (e.g., "Song", "Artist", "Album").
        match: Dictionary containing document data with type-specific
            fields like title, artist, question, or name.

    Returns:
        A formatted display name string for the document.
    """
    if doctype == "Song":
        return f"{match['title']} - {match['artist']}"
    if doctype == "Artist":
        return match["artist"]
    if doctype == "Album":
        return match["title"]
    if doctype == "Drill":
        return match["question"][:30]

    return match["name"].title()


def get_doctype(match: dict[str, Any]) -> str:
    """Determine the display document type from a search result.

    For songs, checks highlighted fields to determine if the match was
    on artist, title, etc., and returns the appropriate type. For other
    types, returns the doctype from the source.

    Args:
        match: Search result dictionary containing "_source" with "doctype"
            and optionally "highlight" fields.

    Returns:
        A title-cased document type string (e.g., "Song", "Artist", "Album").
    """
    if match["_source"]["doctype"] == "song" and "highlight" in match:
        highlight_fields = [x if x != "name" else "Song" for x in match["highlight"].keys()]
        # There could be multiple highlighted fields. For now,
        #  pick the first one.
        # Remove the subfield ".autocomplete" from the result, so
        #  "artist.autocomplete" becomes "artist".
        return highlight_fields[0].split(".")[0].title()

    return match["_source"]["doctype"].title()


def get_doctypes_from_request(request: HttpRequest) -> list[str]:
    """Extract document type filters from request parameters.

    Parses the "doctype" or "doc_type" GET parameter and handles special cases like
    "music" which maps to multiple document types.

    Args:
        request: HTTP request object with GET parameters.

    Returns:
        A list of document type strings to filter by.
    """
    # Accept both "doctype" and "doc_type" for backwards compatibility
    # (ObjectSelectModal sends "doc_type", other places send "doctype")
    doctype_param = request.GET.get("doctype", "") or request.GET.get("doc_type", "")
    if doctype_param != "":
        doctypes = doctype_param.split(",")
    else:
        doctypes = []

    # The front-end filter "Music" translates to the two doctypes
    #  "album" and "song" in the Elasticsearch index
    if "music" in doctypes:
        doctypes = ["album", "song"]

    return doctypes


def is_cached() -> Any:
    """Create a cache checker function for deduplicating results.

    Returns a closure that maintains an in-memory cache of seen
    Artist and Album names to prevent duplicate results in search
    output.

    Returns:
        A function that takes (doctype, value) and returns True if
        the value has been seen before, False otherwise. Only caches
        "Artist" and "Album" doctypes.
    """
    cache: dict[str, dict] = {
        "Artist": {},
        "Album": {}
    }

    def check_cache(doctype: str, value: str) -> bool:
        if doctype not in ["Artist", "Album"]:
            return False

        if value in cache[doctype]:
            return True

        cache[doctype][value] = True
        return False

    return check_cache
