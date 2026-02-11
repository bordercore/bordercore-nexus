"""
Views for the search system.

This module contains views for searching across Bordercore objects using
Elasticsearch, including full-text search, semantic search, tag-based search,
and autocomplete functionality.
"""

from __future__ import annotations

import json
import math
import operator
from typing import Any, cast
from urllib.parse import urlparse

import markdown
from elasticsearch import RequestError

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.urls import reverse
from django.views.generic.list import ListView

from blob.models import Blob
from lib.embeddings import len_safe_get_embedding
from lib.time_utils import get_date_from_pattern, get_relative_date
from lib.util import favicon_url, get_pagination_range, truncate
from tag.models import Tag

from .api import (search_music, search_names, search_names_es,
                  search_tags_and_names, search_tags_es)
from .helpers import (get_creators, get_doctype, get_doctypes_from_request,
                      get_link, get_name, is_cached, sort_results)
from .models import RecentSearch
from .services import build_base_query, execute_search, get_cover_url

# Re-export helpers and API functions so existing imports keep working.
__all__ = [
    "get_creators",
    "get_doctype",
    "get_doctypes_from_request",
    "get_link",
    "get_name",
    "is_cached",
    "search_music",
    "search_names",
    "search_names_es",
    "search_tags_and_names",
    "search_tags_es",
    "sort_results",
]


class SearchListView(LoginRequiredMixin, ListView):
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

    def get_aggregations(self, object_list_dict: dict[str, Any], aggregation: str) -> list[dict[str, Any]]:
        """Extract aggregation data from Elasticsearch results.

        Args:
            object_list_dict: Dictionary containing Elasticsearch search results
                with an "aggregations" key containing aggregation data.
            aggregation: The name of the aggregation to extract from the
                aggregations dictionary.

        Returns:
            A list of dictionaries, each containing:
                - doctype: The aggregation bucket key (typically a document type name)
                - count: The document count for that bucket (doc_count)
        """
        aggregations = []
        for x in object_list_dict["aggregations"][aggregation]["buckets"]:
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

            cover_url = get_cover_url(
                match["source"]["doctype"],
                match["source"].get("uuid", ""),
                match["source"].get("filename", ""),
            )
            if cover_url:
                match["source"]["cover_url"] = cover_url

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

        search_term = (
            self.request.GET.get("term_search")
            or self.request.GET.get("search")
        )
        sort_field = self.request.GET.get("sort", "date_unixtime")
        boolean_type = self.request.GET.get("boolean_search_type", "AND")
        doctype = self.request.GET.get("doctype", None)

        if search_term:
            user = cast(User, self.request.user)
            RecentSearch.add(user, search_term)

        offset = (int(self.request.GET.get("page", 1)) - 1) * self.RESULT_COUNT_PER_PAGE

        search_object = build_base_query(
            cast(int, self.request.user.id),
            size=self.RESULT_COUNT_PER_PAGE,
            offset=offset,
            source_fields=[
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
                "uuid"
            ],
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
            "order": "score"
        }
        search_object["sort"] = {sort_field: {"order": "desc"}}

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
                            "description",
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

        try:
            results = execute_search(search_object, timeout=40)
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
            context["aggregations"] = self.get_aggregations(object_list_dict, "Doctype Filter")

            page = int(self.request.GET.get("page", 1))
            context["paginator"] = json.dumps(
                self.build_pagination_dict(page, object_list_dict["hits"]["total"]["value"])
            )

            context["count"] = object_list_dict["hits"]["total"]["value"]
            context["results"] = object_list_dict["hits"]["hits"]

        return context


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
                - pinned_notes_json: JSON serialized pinned notes for React
                - paginator: JSON-encoded pagination data
                - Other fields from parent class
        """
        context = super().get_context_data(**kwargs)
        context["title"] = "Notes"

        if "search" not in self.request.GET:
            user = cast(User, self.request.user)
            pinned_notes = user.userprofile.pinned_notes.all().only("file", "name", "uuid").order_by("usernote__sort_order")
            context["pinned_notes"] = pinned_notes
            context["pinned_notes_json"] = [
                {
                    "uuid": str(note.uuid),
                    "name": note.name,
                    "url": reverse("blob:detail", kwargs={"uuid": note.uuid}),
                }
                for note in pinned_notes
            ]
        else:
            context["pinned_notes_json"] = []

        if "results" in context:
            page = int(self.request.GET.get("page", 1))

            context["paginator"] = json.dumps(
                self.build_pagination_dict(page, context["count"])
            )

        return context


class SearchTagDetailView(LoginRequiredMixin, ListView):
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
                    "cover_url": get_cover_url(
                        match["_source"]["doctype"],
                        match["_source"].get("uuid", ""),
                        match["_source"].get("filename", ""),
                    ) or "",
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

        # Use the keyword field for an exact match
        tag_query = [
            {
                "term": {
                    "tags.keyword": x
                }
            }
            for x in taglist
        ]

        search_object = build_base_query(
            cast(int, self.request.user.id),
            additional_must=tag_query,
            size=self.RESULT_COUNT_PER_PAGE,
        )
        search_object["aggs"] = {
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
        }
        search_object["sort"] = [
            {"importance": {"order": "desc"}},
            {"last_modified": {"order": "desc"}}
        ]

        return execute_search(search_object)

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
        for bucket in aggregation["buckets"]:
            if bucket["key"] not in tag_list:
                tag_counts[bucket["key"]] = bucket["doc_count"]

        tag_counts_sorted = sorted(tag_counts.items(), key=operator.itemgetter(1), reverse=True)

        return tag_counts_sorted


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
