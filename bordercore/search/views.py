"""
Views for the search system.

This module contains views for searching across Bordercore objects using
Elasticsearch, including full-text search, semantic search, tag-based search,
and autocomplete functionality.
"""

from __future__ import annotations

import datetime
import json
import math
import operator
import re
from typing import Any, cast
from urllib.parse import unquote, urlparse

import markdown
from elasticsearch import RequestError
from rest_framework.decorators import api_view
from rest_framework.request import Request

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import HttpRequest, JsonResponse
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.generic.list import ListView

from blob.models import Blob
from bookmark.models import Bookmark
from lib.embeddings import len_safe_get_embedding
from lib.time_utils import get_date_from_pattern, get_relative_date
from lib.util import (favicon_url, get_elasticsearch_connection,
                      get_pagination_range, truncate)
from music.models import Album
from tag.models import Tag
from tag.services import get_tag_aliases, get_tag_link

from .models import RecentSearch

SEARCH_LIMIT = 1000


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


@method_decorator(login_required, name="dispatch")
class SearchListView(ListView):
    """View for displaying search results.

    This view handles full-text search queries against Elasticsearch,
    displays paginated results, and provides filtering by document type.
    """

    template_name = "search/search.html"
    RESULT_COUNT_PER_PAGE = 10
    is_notes_search = False

    def build_pagination_dict(self, page: int, num_results: int) -> dict[str, Any]:
        """Build pagination data dictionary for search results.

        Args:
            page: The current page number (1-indexed).
            num_results: Total number of search results.

        Returns:
            A dictionary containing pagination information:
                - page_number: Current page number
                - num_pages: Total number of pages
                - total_results: Total number of results
                - range: List of page numbers to display
                - has_previous: Whether there is a previous page
                - has_next: Whether there is a next page
                - previous_page_number: Previous page number
                - next_page_number: Next page number
            Returns empty dict if num_results is 0.
        """

        if num_results == 0:
            return {}

        num_pages = int(math.ceil(num_results / self.RESULT_COUNT_PER_PAGE))
        paginate_by = 2

        paginator = {
            "page_number": page,
            "num_pages": num_pages,
            "total_results": num_results,
            "range": get_pagination_range(
                page,
                num_pages,
                paginate_by
            )
        }

        paginator["has_previous"] = page != 1
        paginator["has_next"] = page != paginator["num_pages"]

        paginator["previous_page_number"] = page - 1
        paginator["next_page_number"] = page + 1

        return paginator

    def get_aggregations(self, context: dict[str, Any], aggregation: str) -> list[dict[str, Any]]:
        """Extract aggregation data from Elasticsearch results.

        Args:
            context: Context dictionary containing search results with
                aggregations data.
            aggregation: The name of the aggregation to extract.

        Returns:
            A list of dictionaries, each containing:
                - doctype: The document type name
                - count: The number of documents of that type
        """
        aggregations = []
        for x in context["object_list"]["aggregations"][aggregation]["buckets"]:
            aggregations.append({"doctype": x["key"], "count": x["doc_count"]})
        return aggregations

    def filter_results(self, results: list[dict[str, Any]], search_term: str | None) -> None:
        """Process and filter search results for display.

        This method modifies the results in-place, adding computed fields
        like URLs, cover images, formatted dates, and markdown rendering
        for certain document types.

        Args:
            results: List of search result dictionaries from Elasticsearch.
            search_term: The search query string, or None if no text search
                was performed.
        """

        for match in results:
            # Django templates don't support variables with underscores or dots, so
            #  we need to rename a couple of fields
            match["source"] = match.pop("_source")
            match["score"] = match.pop("_score")

            match["source"]["creators"] = get_creators(match["source"])
            match["source"]["date"] = get_date_from_pattern(match["source"].get("date", None))
            match["source"]["last_modified"] = get_relative_date(match["source"]["last_modified"])
            match["source"]["url"] = get_link(match["source"]["doctype"], match["source"])

            if match["source"]["doctype"] in ["book", "blob"]:
                match["source"]["cover_url"] = Blob.get_cover_url_static(
                    match["source"]["uuid"],
                    match["source"]["filename"],
                    size="small"
                )

            match["tags_json"] = json.dumps(match["source"]["tags"]) \
                if "tags" in match["source"] \
                   else "[]"

            if "highlight" in match and "attachment.content" in match["highlight"]:
                match["highlight"]["attachment_content"] = match["highlight"].pop("attachment.content")

            # Highlight matched terms using markdown italicized text when searching
            if search_term and "contents" in match["source"]:
                match["source"]["contents"] = match["source"]["contents"].replace(search_term, f"*{search_term}*")

            # Display markdown for drill questions and todo items
            if match["source"]["doctype"] == "drill":
                match["source"]["question"] = markdown.markdown(match["source"]["question"])
            if match["source"]["doctype"] == "todo":
                match["source"]["name"] = markdown.markdown(match["source"]["name"])

    def get_queryset(self) -> Any:
        """Build and execute the Elasticsearch query.

        Constructs an Elasticsearch query based on request parameters,
        including search term, sorting, filtering, and pagination.
        Handles both regular text search and semantic search.

        Returns:
            Elasticsearch search results dictionary with keys like "hits",
            "aggregations", etc., or empty list if no search parameters
            are provided (unless is_notes_search is True).
        """
        if not any(key in self.request.GET for key in [
                "search",
                "term_search",
                "semantic_search"
        ]) and not self.is_notes_search:
            return []

        # Store the "sort" field in the user's session
        self.request.session["search_sort_by"] = self.request.GET.get("sort", None)

        search_term = self.request.GET.get("term_search", None) or \
            self.request.GET.get("search", None)
        sort_field = self.request.GET.get("sort", "date_unixtime")
        boolean_type = self.request.GET.get("boolean_search_type", "AND")
        doctype = self.request.GET.get("doctype", None)

        if search_term:
            user = cast(User, self.request.user)
            RecentSearch.add(user, search_term)

        offset = (int(self.request.GET.get("page", 1)) - 1) * self.RESULT_COUNT_PER_PAGE

        search_object: dict[str, Any] = {
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
                            "must": [
                                {
                                    "term": {
                                        "user_id": self.request.user.id
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            "aggs": {
                "Doctype Filter": {
                    "terms": {
                        "field": "doctype",
                        "size": 10,
                    }
                }
            },
            "highlight": {
                "fields": {
                    "attachment.content": {},
                    "contents": {},
                },
                "number_of_fragments": 1,
                "fragment_size": 200,
                "order": "score"
            },
            "sort": {sort_field: {"order": "desc"}},
            "from_": offset,
            "size": self.RESULT_COUNT_PER_PAGE,
            "_source": [
                "album_uuid",
                "artist",
                "artist_uuid",
                "author",
                "bordercore_id",
                "date",
                "date_unixtime",
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
                "uuid"
            ]
        }

        # Let subclasses modify the query
        search_object = self.refine_search(search_object)

        if doctype:
            search_object["post_filter"] = {
                "term": {
                    "doctype": doctype
                }
            }

        # Skip this for semantic searches
        if search_term:
            search_object["query"]["function_score"]["query"]["bool"]["must"].append(
                {
                    "multi_match": {
                        "type": "phrase" if self.request.GET.get("exact_match", None) in ["Yes"] else "best_fields",
                        "query": search_term,
                        "fields": [
                            "answer",
                            "metadata.*",
                            "attachment.content",
                            "contents",
                            "name",
                            "question",
                            "sha1sum",
                            "title",
                            "uuid"
                        ],
                        "operator": boolean_type,
                    }
                }
            )

        es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT, timeout=40)
        try:
            results = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)
        except RequestError as e:
            error_info = cast(dict[str, Any], e.info)
            messages.add_message(self.request, messages.ERROR, f"Request Error: {e.status_code} {error_info.get('error')}")
            return []

        self.filter_results(results["hits"]["hits"], search_term)

        return results

    def refine_search(self, search_object: dict[str, Any]) -> dict[str, Any]:
        """Allow subclasses to modify the search query.

        This method can be overridden by subclasses to customize the
        Elasticsearch query before execution.

        Args:
            search_object: The Elasticsearch query dictionary.

        Returns:
            The (possibly modified) search query dictionary.
        """
        return search_object

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the search results template.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - doctype_filter: List of selected document types
                - title: Page title
                - aggregations: Document type aggregation data
                - paginator: JSON-encoded pagination data
                - count: Total number of results
                - results: List of search result hits
        """
        context = super().get_context_data(**kwargs)

        context["doctype_filter"] = self.request.GET.get("doctype", "").split(",")
        context["title"] = "Search"

        if context["object_list"]:
            object_list_dict = cast(dict[str, Any], context["object_list"])
            context["aggregations"] = self.get_aggregations(context, "Doctype Filter")

            page = int(self.request.GET.get("page", 1))
            context["paginator"] = json.dumps(
                self.build_pagination_dict(page, object_list_dict["hits"]["total"]["value"])
            )

            context["count"] = object_list_dict["hits"]["total"]["value"]
            context["results"] = object_list_dict["hits"]["hits"]

        return context


@method_decorator(login_required, name="dispatch")
class NoteListView(SearchListView):
    """View for displaying note search results.

    A specialized search view that filters results to only show notes
    and supports tag-based filtering.
    """

    template_name = "blob/note_list.html"
    RESULT_COUNT_PER_PAGE = 10
    is_notes_search = True

    def refine_search(self, search_object: dict[str, Any]) -> dict[str, Any]:
        """Refine the search query for note-specific searches.

        Adds filters to restrict results to notes and optionally filter
        by tag. Also ensures the "contents" field is included in results.

        Args:
            search_object: The Elasticsearch query dictionary.

        Returns:
            The modified search query dictionary with note-specific filters.
        """

        page = int(self.request.GET.get("page", 1))
        search_object["from_"] = (page - 1) * self.RESULT_COUNT_PER_PAGE

        search_object["_source"].append("contents")

        search_object["query"]["function_score"]["query"]["bool"]["must"].append(
            {
                "term": {
                    "doctype": "note"
                }
            }
        )

        tagsearch = self.request.GET.get("tagsearch", None)
        if tagsearch:
            search_object["query"]["function_score"]["query"]["bool"]["must"].append(
                {
                    "term": {
                        "tags.keyword": tagsearch
                    }
                }
            )

        return search_object

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the note list template.

        Includes pinned notes when no search is performed, and ensures
        pagination data is properly formatted.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary with note-specific data:
                - pinned_notes: List of pinned notes (when no search)
                - paginator: JSON-encoded pagination data
                - Other fields from parent class
        """
        context = super().get_context_data(**kwargs)

        if "search" not in self.request.GET:
            user = cast(User, self.request.user)
            context["pinned_notes"] = user.userprofile.pinned_notes.all().only("file", "name", "uuid").order_by("usernote__sort_order")

        if "results" in context:
            page = int(self.request.GET.get("page", 1))

            context["paginator"] = json.dumps(
                self.build_pagination_dict(page, context["count"])
            )

        return context


@method_decorator(login_required, name="dispatch")
class SearchTagDetailView(ListView):
    """View for displaying search results filtered by tags.

    This view shows all objects that have been tagged with specific tags,
    organized by document type.
    """

    template_name = "search/tag_detail.html"
    RESULT_COUNT_PER_PAGE = 1000

    def filter_results(self) -> dict[str, list[dict[str, Any]]]:
        """Process and organize search results by document type.

        Transforms Elasticsearch results into a dictionary keyed by
        document type, with each value being a list of formatted result
        dictionaries.

        Returns:
            A dictionary mapping document type names to lists of result
            dictionaries, each containing fields like name, title, url,
            uuid, tags, etc.
        """
        results: dict[str, list[dict[str, Any]]] = {}
        object_list_dict = cast(dict[str, Any], self.object_list)
        for match in object_list_dict["hits"]["hits"]:

            result = {
                "artist": match["_source"].get("artist", ""),
                "artist_uuid": match["_source"].get("artist_uuid", ""),
                "question": truncate(match["_source"].get("question", "")),
                "name": match["_source"].get("name", "No Name"),
                "title": match["_source"].get("title", "No Title"),
                "task": match["_source"].get("name", ""),
                "url": match["_source"].get("url", "") or "",
                "uuid": match["_source"].get("uuid", ""),
                "creators": get_creators(match["_source"]),
                "contents": match["_source"].get("contents", "")[:200],
                "date": get_date_from_pattern(match["_source"].get("date", None))
            }

            if "tags" in match["_source"]:
                # Only show tags that were not searched for
                result["tags"] = [
                    {
                        "name": tag,
                        "url": reverse("search:kb_search_tag_detail", args=[tag])
                    }
                    for tag in match["_source"]["tags"]
                    if tag not in self.kwargs["taglist"]
                ]

            if "sha1sum" in match["_source"]:
                result = {
                    "sha1sum": match["_source"]["sha1sum"],
                    "filename": match["_source"].get("filename", ""),
                    "url": Blob.get_s3_key(
                        match["_source"]["uuid"],
                        match["_source"].get("filename", "")
                    ),
                    "cover_url": Blob.get_cover_url_static(
                        match["_source"].get("uuid", ""),
                        match["_source"].get("filename", ""),
                        size="small"
                    ),
                    **result,
                }

                if "content_type" in match["_source"]:
                    result["content_type"] = Blob.get_content_type(match["_source"]["content_type"])

            if match["_source"]["doctype"] == "album":
                result["album_artwork_url"] = f"{settings.IMAGES_URL}album_artwork/{match['_source']['uuid']}"

            result["favicon_url"] = favicon_url(result["url"])
            result["url_domain"] = urlparse(result["url"]).netloc
            result["object_url"] = get_link(get_doctype(match).lower(), match["_source"])

            results.setdefault(match["_source"]["doctype"], []).append(result)

        return results

    def get_queryset(self) -> Any:
        """Build and execute Elasticsearch query for tag-based search.

        Constructs a query that matches documents containing all specified
        tags, with aggregations for document types and additional tags.

        Returns:
            Elasticsearch search results dictionary containing hits and
            aggregations.
        """
        taglist = self.kwargs.get("taglist", "").split(",")

        es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

        # Use the keyword field for an exact match
        tag_query = [
            {
                "term": {
                    "tags.keyword": x
                }
            }
            for x in taglist
        ]

        tag_query.append(
            {
                "term": {
                    "user_id": self.request.user.id
                }
            }
        )

        search_object = {
            "query": {
                "function_score": {
                    "field_value_factor": {
                        "field": "importance",
                        "missing": 1
                    },
                    "query": {
                        "bool": {
                            "must": tag_query
                        }
                    }
                }
            },
            "aggs": {
                "Doctype Filter": {
                    "terms": {
                        "field": "doctype",
                        "size": 10
                    }
                },
                "Tag Filter": {
                    "terms": {
                        "field": "tags.keyword",
                        "size": 20
                    }
                }
            },
            "sort": [
                {"importance": {"order": "desc"}},
                {"last_modified": {"order": "desc"}}
            ],
            "from_": 0,
            "size": self.RESULT_COUNT_PER_PAGE,
            "_source": [
                "artist",
                "artist_uuid",
                "author",
                "content_type",
                "contents",
                "date",
                "date_unixtime",
                "doctype",
                "filename",
                "importance",
                "bordercore_id",
                "last_modified",
                "name",
                "question",
                "sha1sum",
                "tags",
                "title",
                "url",
                "uuid"
            ]
        }

        return es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the tag detail template.

        Processes aggregations to provide tag and document type counts,
        excluding tags that are already being searched for.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - results: Filtered and organized search results
                - tag_counts: List of (tag, count) tuples for other tags
                - doctype_counts: List of (doctype, count) tuples
                - meta_tags: List of meta tag names
                - doctypes: List of document type names
                - search_tag_detail_current_tab: Current tab from session
                - tag_list: List of tags being searched
                - title: Page title
        """
        context = super().get_context_data(**kwargs)

        context["results"] = self.filter_results()

        tag_list = self.kwargs.get("taglist", "").split(",") if "taglist" in self.kwargs else []

        object_list_dict = cast(dict[str, Any], self.object_list)
        # Get a list of tags and their counts, to be displayed
        #  in the "Other tags" dropdown
        context["tag_counts"] = self.get_doc_counts(
            tag_list,
            object_list_dict["aggregations"]["Tag Filter"]
        )

        # Get a list of doc types and their counts
        context["doctype_counts"] = self.get_doc_counts(
            tag_list,
            object_list_dict["aggregations"]["Doctype Filter"]
        )

        user = cast(User, self.request.user)
        context["meta_tags"] = [x[0] for x in context["tag_counts"] if x[0] in Tag.get_meta_tags(user)]
        context["doctypes"] = [x[0] for x in context["doctype_counts"]]
        context["search_tag_detail_current_tab"] = self.request.session.get("search_tag_detail_current_tab", "")
        context["tag_list"] = tag_list
        context["title"] = f"Search :: Tag Detail :: {', '.join(tag_list)}"

        return context

    def get_doc_counts(self, tag_list: list[str], aggregation: dict[str, Any]) -> list[tuple[str, int]]:
        """Extract counts from aggregation, excluding specified tags.

        Args:
            tag_list: List of tag names to exclude from the results.
            aggregation: Elasticsearch aggregation result dictionary
                containing buckets with keys and doc_count values.

        Returns:
            A sorted list of (name, count) tuples, sorted by count in
            descending order, excluding items in tag_list.
        """
        tag_counts = {}
        for buckets in aggregation["buckets"]:
            if buckets["key"] not in tag_list:
                tag_counts[buckets["key"]] = buckets["doc_count"]

        tag_counts_sorted = sorted(tag_counts.items(), key=operator.itemgetter(1), reverse=True)

        return tag_counts_sorted


@method_decorator(login_required, name="dispatch")
class SemanticSearchListView(SearchListView):
    """View for semantic/vector-based search.

    Performs similarity search using embeddings vectors to find documents
    semantically similar to the search query.
    """

    def refine_search(self, search_object: dict[str, Any]) -> dict[str, Any]:
        """Refine the search query for semantic search.

        Replaces the text-based query with a cosine similarity search
        using embeddings vectors. Removes importance-based scoring in
        favor of similarity scoring.

        Args:
            search_object: The Elasticsearch query dictionary.

        Returns:
            The modified search query dictionary configured for semantic
            similarity search.
        """

        embeddings = len_safe_get_embedding(self.request.GET["semantic_search"])

        search_object["sort"] = {"_score": {"order": "desc"}}

        # Remove the function that heavily weighs important blobs
        search_object["query"]["function_score"]["query"]["bool"]["must"].pop(-1)

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

        return search_object


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
        "Todo": []
    }

    for match in matches:
        types[match["doctype"]].append(match)

    # Remove empty categories
    result = {key: value for (key, value) in types.items() if len(value) > 0}

    response = []
    for key, value in result.items():
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
        highlight_fields = list(match["highlight"].keys())

        highlight_fields = [x if x != "name" else "Song" for x in match["highlight"].keys()]
        # There could be multiple highlighted fields. For now,
        #  pick the first one.
        # Remove the subfield ".autocomplete" from the result, so
        #  "artist.autocomplete" becomes "artist".
        return highlight_fields[0].split(".")[0].title()

    return match["_source"]["doctype"].title()


def get_doctypes_from_request(request: HttpRequest) -> list[str]:
    """Extract document type filters from request parameters.

    Parses the "doctype" GET parameter and handles special cases like
    "music" which maps to multiple document types.

    Args:
        request: HTTP request object with GET parameters.

    Returns:
        A list of document type strings to filter by.
    """
    doctype_param = request.GET.get("doctype", "")
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

    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

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
        "_source": ["album_id",
                    "album",
                    "artist",
                    "author",
                    "date",
                    "date_unixtime",
                    "doctype",
                    "filename",
                    "importance",
                    "name",
                    "question",
                    "sha1sum",
                    "tags",
                    "url",
                    "uuid"]
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

    results = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

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

    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

    search_object: dict[str, Any] = {
        "query": {
            "function_score": {
                "field_value_factor": {
                    "field": "importance",
                    "missing": 1
                },
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
                        ]
                    }
                }
            }
        },
        "highlight": {
            "fields": {
                "name.autocomplete": {},
                "artist.autocomplete": {}
            }
        },
        "from_": 0,
        "size": SEARCH_LIMIT,
        "_source": ["album_uuid",
                    "album",
                    "artist",
                    "artist_uuid",
                    "author",
                    "bordercore_id",
                    "date",
                    "date_unixtime",
                    "doctype",
                    "filename",
                    "importance",
                    "name",
                    "note",
                    "question",
                    "sha1sum",
                    "tags",
                    "title",
                    "url",
                    "uuid"]
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

    results = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)
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
            matches.append(
                {
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
            )
            if doctype_pretty in ["Blob", "Book", "Document"]:
                matches[-1]["cover_url"] = Blob.get_cover_url_static(
                    match["_source"].get("uuid"),
                    match["_source"].get("filename"),
                    size="small"
                )
                matches[-1]["type"] = "blob"
            if doctype_pretty == "Bookmark":
                matches[-1]["cover_url"] = Bookmark.thumbnail_url_static(
                    match["_source"].get("uuid"),
                    match["_source"].get("url"),
                )
                matches[-1]["type"] = "bookmark"

    return matches


@api_view(["GET"])
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

    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT)

    search_object: dict[str, Any] = {
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
                        "must": [
                            {
                                "term": {
                                    "user_id": request.user.id
                                }
                            }
                        ]
                    }
                }
            }
        },
        "from_": 0,
        "size": limit,
        "_source": ["album_uuid",
                    "album",
                    "artist",
                    "artist_uuid",
                    "author",
                    "bordercore_id",
                    "date",
                    "date_unixtime",
                    "doctype",
                    "filename",
                    "importance",
                    "name",
                    "note",
                    "question",
                    "sha1sum",
                    "tags",
                    "title",
                    "track",
                    "url",
                    "uuid"]
    }

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

    results = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

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
