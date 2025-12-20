"""Django services module for blob application.

This module provides service functions for managing blobs, including retrieval,
importing from external sources (Instagram, ArtStation, New York Times), and
chatbot functionality using OpenAI.
"""

import datetime
import hashlib
import itertools
import json
import os
import re
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any, Generator, Union
from urllib.parse import ParseResult, urlparse

import humanize
import instaloader
import requests
import trafilatura
from instaloader import Post
from openai import OpenAI
from trafilatura import (bare_extraction, extract, extract_metadata, fetch_url)

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files import File
from django.core.files.temp import NamedTemporaryFile
from django.db.models import Q, QuerySet
from django.http import HttpRequest
from django.urls import reverse
from django.utils import timezone

from blob.models import Blob, MetaData, RecentlyViewedBlob
from bookmark.models import Bookmark
from drill.models import Question
from fitness.models import Exercise
from lib.exceptions import (NodeNotFoundError, ObjectAlreadyRelatedError,
                            RelatedObjectNotFoundError,
                            UnsupportedNodeTypeError)
from lib.util import get_elasticsearch_connection, is_image, is_pdf, is_video
from search.services import semantic_search


def get_recent_blobs(user: User, limit: int = 10, skip_content: bool = False) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Get the most recently created blobs for a user.

    Retrieves the most recently created blobs for the specified user, along
    with counts of their doctypes. Results are cached per user and include
    blob metadata, tags, URLs, and optionally content previews.

    Args:
        user: The user to get recent blobs for.
        limit: Maximum number of blobs to retrieve. Defaults to 10.
        skip_content: Whether to skip including blob content in the results.
            Defaults to False.

    Returns:
        A tuple containing:
            - List of blob dictionaries with metadata including:
                - name: Blob name
                - tags: List of tag names
                - url: URL to blob detail page
                - delta_days: Days since blob was last modified
                - uuid: Blob UUID as string
                - doctype: Document type
                - type: Always "blob"
                - content: Blob content preview (if skip_content is False)
                - content_size: Humanized content size (if available)
                - cover_url: Cover image URL (for images/PDFs/videos)
                - cover_url_small: Small cover image URL (for images/PDFs/videos)
            - Dictionary mapping doctype names to counts, including an "all"
              key with the total count
    """

    # Create user-specific cache key
    cache_key = f"recent_blobs_{user.id}_{limit}"

    cached_blobs = cache.get(cache_key)
    if cached_blobs is not None:
        return cached_blobs

    blob_list = Blob.objects.filter(
        user=user
    ).prefetch_related(
        "tags", "metadata"
    ).order_by(
        "-created"
    )[:limit]

    blob_sizes = get_blob_sizes(blob_list)

    doctypes = defaultdict(int)
    doctypes["all"] = len(blob_list)

    returned_blob_list = []

    for blob in blob_list:
        delta = timezone.now() - blob.modified

        blob_dict = {
            "name": blob.name,
            "tags": ", ".join(sorted(tag.name for tag in blob.tags.all())),
            "url": reverse("blob:detail", kwargs={"uuid": blob.uuid}),
            "delta_days": delta.days,
            "uuid": str(blob.uuid),
            "doctype": blob.doctype,
            "type": "blob",
        }

        if blob.content and not skip_content:
            blob_dict["content"] = blob.content[:10000]
            blob_dict["content_size"] = humanize.naturalsize(len(blob.content))

        get_blob_naturalsize(blob_sizes, blob_dict)

        if is_image(blob.file) or is_pdf(blob.file) or is_video(blob.file):
            blob_dict["cover_url"] = blob.get_cover_url(size="large")
            blob_dict["cover_url_small"] = blob.get_cover_url(size="small")

        returned_blob_list.append(blob_dict)

        doctypes[blob.doctype] += 1

    cache.set(cache_key, (returned_blob_list, doctypes))

    return returned_blob_list, doctypes


def get_recent_media(user: User, limit: int = 10) -> list[dict[str, Any]]:
    """Get the most recently created images and videos for a user.

    Retrieves the most recently created image and video blobs for the
    specified user. Results are cached per user and include blob metadata,
    tags, URLs, and cover image URLs.

    Args:
        user: The user to get recent media for.
        limit: Maximum number of media items to retrieve. Defaults to 10.

    Returns:
        List of blob dictionaries with metadata including:
            - name: Blob name
            - tags: List of tag names
            - url: URL to blob detail page
            - delta_days: Days since blob was last modified
            - uuid: Blob UUID as string
            - type: Always "blob"
            - cover_url: Cover image URL
            - cover_url_small: Small cover image URL
    """

    # Create user-specific cache key
    cache_key = f"recent_media_{user.id}_{limit}"

    cached_media = cache.get(cache_key)
    if cached_media is not None:
        return cached_media

    image_list = Blob.objects.filter(
        Q(user=user) & (
            Q(file__endswith="bmp") | Q(file__endswith="gif")
            | Q(file__endswith="jpg") | Q(file__endswith="jpeg")
            | Q(file__endswith="png") | Q(file__endswith="tiff")
            | Q(file__endswith="avi") | Q(file__endswith="flv")
            | Q(file__endswith="m4v") | Q(file__endswith="mkv")
            | Q(file__endswith="mp4") | Q(file__endswith="webm")
        )
    ).prefetch_related(
        "tags", "metadata"
    ).order_by(
        "-created"
    )[:limit]

    returned_image_list = []

    for blob in image_list:
        delta = timezone.now() - blob.modified

        blob_dict = {
            "name": blob.name,
            "tags": ", ".join(sorted(tag.name for tag in blob.tags.all())),
            "url": reverse("blob:detail", kwargs={"uuid": blob.uuid}),
            "delta_days": delta.days,
            "uuid": str(blob.uuid),
            "type": "blob",
            "cover_url": blob.get_cover_url(size="large"),
            "cover_url_small": blob.get_cover_url(size="small")
        }

        returned_image_list.append(blob_dict)

    cache.set(cache_key, returned_image_list)

    return returned_image_list


def get_recently_viewed(user: User) -> list[dict[str, Any]]:
    """Get a list of recently viewed blobs and nodes for a user.

    Retrieves recently viewed blobs and nodes for the specified user,
    ordered by most recently viewed first. Includes metadata such as
    URLs, cover images, doctypes, names, and UUIDs.

    Args:
        user: The user to get recently viewed items for.

    Returns:
        List of dictionaries containing recently viewed items with:
            - url: URL to detail page (blob or node)
            - cover_url: Cover image URL (for blobs only)
            - cover_url_small: Small cover image URL (for blobs only)
            - doctype: Document type (capitalized for blobs, "Node" for nodes)
            - name: Item name
            - uuid: Item UUID
    """

    objects = RecentlyViewedBlob.objects.filter(
        Q(blob__user=user) | Q(node__user=user)
    ).order_by(
        "-created"
    ).select_related(
        "blob",
        "node"
    ).prefetch_related(
        "blob__metadata"
    )

    object_list = []
    for x in objects:
        if x.blob:
            object_list.append(
                {
                    "url": reverse("blob:detail", kwargs={"uuid": x.blob.uuid}),
                    "cover_url": x.blob.get_cover_url(size="large"),
                    "cover_url_small": x.blob.get_cover_url(size="small"),
                    "doctype": x.blob.doctype.capitalize(),
                    "name": x.blob.name or "No name",
                    "uuid": x.blob.uuid
                }
            )
        elif x.node:
            object_list.append(
                {
                    "url": reverse("node:detail", kwargs={"uuid": x.node.uuid}),
                    "doctype": "Node",
                    "name": x.node.name,
                    "uuid": x.node.uuid
                }
            )

    return object_list


def get_books(user: User, tag: str | None = None, search: str | None = None) -> dict[str, Any]:
    """Search for book blobs using Elasticsearch.

    Searches for book-type blobs in Elasticsearch, optionally filtered by
    tag or search term. Results are ordered by last modified date (newest first).

    Args:
        user: The user to scope the search to.
        tag: Optional tag name to filter results by. If provided, increases
            result limit to 1000.
        search: Optional search term to match against metadata, name, and title
            fields. If provided, increases result limit to 1000.

    Returns:
        Elasticsearch search result dictionary containing:
            - hits: Search results with document metadata
            - Other Elasticsearch response fields

    Note:
        Default result limit is 10, but increases to 1000 when tag or search
        parameters are provided.
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
                        "term": {
                            "doctype": "book"
                        }
                    }
                ]
            }
        },
        "sort": [
            {"last_modified": {"order": "desc"}}
        ],
        "from": 0,
        "size": 10,
        "_source": [
            "date",
            "date_unixtime",
            "filename",
            "last_modified",
            "name",
            "tags",
            "title",
            "url",
            "uuid"
        ]
    }

    if tag:
        search_object["query"]["bool"]["must"].append(
            {
                "term": {
                    "tags.keyword": tag
                }
            }
        )
        search_object["size"] = 1000

    if search:
        search_object["query"]["bool"]["must"].append(
            {
                "multi_match": {
                    "query": search,
                    "fields": [
                        "metadata.*",
                        "name",
                        "title",
                    ],
                    "operator": "OR",
                }
            }
        )
        search_object["size"] = 1000

    return es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)


def get_blob_sizes(blob_list: QuerySet[Blob]) -> dict[str, dict[str, Any]]:
    """Query Elasticsearch for the sizes of a list of blobs.

    Retrieves file size information from Elasticsearch for the specified
    blobs. Uses a short timeout to avoid blocking on slow Elasticsearch
    connections.

    Args:
        blob_list: QuerySet of Blob objects to get sizes for.

    Returns:
        Dictionary mapping blob UUID strings to dictionaries containing:
            - size: File size in bytes
            - uuid: Blob UUID

    Note:
        Only blobs found in Elasticsearch will be included in the result.
        Missing blobs are silently excluded.
    """

    search_object = {
        "query": {
            "bool": {
                "should": [
                    {
                        "term": {
                            "_id": str(x.uuid)
                        }
                    }
                    for x
                    in blob_list
                ]
            }
        },
        "_source": ["size", "uuid"]
    }

    es = get_elasticsearch_connection(host=settings.ELASTICSEARCH_ENDPOINT, timeout=5)
    found = es.search(index=settings.ELASTICSEARCH_INDEX, **search_object)

    blob_cache = {}
    for match in found["hits"]["hits"]:
        blob_cache[match["_source"]["uuid"]] = match["_source"]

    return blob_cache


def get_blob_naturalsize(blob_sizes: dict[str, dict[str, Any]], blob: dict[str, Any]) -> None:
    """Add a humanized size string to a blob dictionary.

    Modifies the blob dictionary in-place to add a "content_size" key with
    a human-readable file size (e.g., "1.5 MB") if size information is
    available for the blob.

    Args:
        blob_sizes: Dictionary mapping blob UUID strings to size information.
        blob: Blob dictionary to modify. Must contain a "uuid" key.

    Note:
        This function modifies the blob dictionary in-place. If size
        information is not available, the blob dictionary is not modified.
    """

    if blob["uuid"] in blob_sizes and "size" in blob_sizes[blob["uuid"]]:
        blob["content_size"] = humanize.naturalsize(blob_sizes[blob["uuid"]]["size"])


def import_blob(user: User, url: str) -> Union[Blob, dict[str, Any]]:
    """Import a blob from an external URL.

    Determines the source domain from the URL and delegates to the
    appropriate import function for Instagram, New York Times, or ArtStation.
    If the domain is not specifically supported, it falls back to generic
    article extraction.

    Args:
        user: The user importing the blob.
        url: The URL to import from.

    Returns:
        The created Blob instance, or a dictionary containing extracted
        article data if generic extraction was used.

    Raises:
        ValueError: If the domain is not supported and generic extraction fails.
    """

    parsed_url = urlparse(url)

    # We want the domain part of the hostname (eg bordercore.com instead of www.bordercore.com)
    # Extract the last two parts of the domain (handles both www.example.com and example.com)
    domain_parts = parsed_url.netloc.split(".")
    if len(domain_parts) >= 2:
        domain = ".".join(domain_parts[-2:])
    else:
        domain = parsed_url.netloc

    if domain == "instagram.com":
        return import_instagram(user, parsed_url)
    if domain == "nytimes.com":
        return import_newyorktimes(user, url)
    if domain == "artstation.com":
        return import_artstation(user, parsed_url)

    # Fallback to generic article extraction
    extracted_data = extract_article_data(url)
    if extracted_data["success"]:
        return extracted_data

    raise ValueError(f"Site not supported for importing: <strong>{domain}</strong>. Generic extraction also failed: {extracted_data.get('error')}")


def extract_article_data(url: str) -> dict[str, Any]:
    """Extract article metadata and content from a URL using trafilatura.

    Args:
        url: The URL of the article to extract.

    Returns:
        A dictionary containing:
            - success: Boolean indicating if extraction was successful.
            - title: Extracted title (optional).
            - content: Extracted main text content (optional).
            - author: Extracted author name (optional).
            - date: Extracted publication date (optional).
            - url: Original URL.
            - error: Error message if success is False.
    """
    try:
        downloaded = fetch_url(url)
        if not downloaded:
            return {
                "success": False,
                "error": "Failed to download content from URL.",
                "url": url
            }

        # Try bare_extraction first for full metadata
        result = bare_extraction(downloaded, url=url, with_metadata=True)

        if result:
            extracted_date = result.get("date")
            # Normalize the date to YYYY-MM-DD format to avoid timezone issues
            normalized_date = parse_date(extracted_date) if extracted_date else None
            return {
                "success": True,
                "title": result.get("title"),
                "content": result.get("text"),
                "author": result.get("author"),
                "date": normalized_date,
                "url": url
            }

        # Fallback to separate extraction
        content = extract(downloaded, url=url)
        metadata = extract_metadata(downloaded)

        if not content and not metadata:
            return {
                "success": False,
                "error": "Failed to extract article content or metadata.",
                "url": url
            }

        extracted_date = getattr(metadata, "date", None) if metadata else None
        # Normalize the date to YYYY-MM-DD format to avoid timezone issues
        normalized_date = parse_date(extracted_date) if extracted_date else None

        return {
            "success": True,
            "title": getattr(metadata, "title", None) if metadata else None,
            "content": content,
            "author": getattr(metadata, "author", None) if metadata else None,
            "date": normalized_date,
            "url": url
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "url": url
        }


def parse_shortcode(shortcode: str) -> str:
    """Extract a shortcode from a URL or return it if already a shortcode.

    Parses various URL formats to extract the shortcode identifier used
    by Instagram and ArtStation. Handles full URLs, partial URLs, and
    plain shortcode strings.

    Args:
        shortcode: A URL string or shortcode identifier. Examples:
            - "https://www.instagram.com/p/CPLicD6K1uv/"
            - "https://www.artstation.com/artwork/CPLicD6K1uv/"
            - "CPLicD6K1uv"

    Returns:
        The extracted shortcode string.

    Raises:
        ValueError: If the shortcode cannot be parsed from the input.
    """

    patterns = [
        r"^https://www.artstation.com/artwork/([^\/]+)/*",
        r"^https://www.instagram.com/\w+/([^\/]+)/*",
        r"^([\w\d]+)$"
    ]

    # url = "https://www.instagram.com/p/CPLicD6K1uv/?utm_source=ig_web_copy_link"
    # url = "https://www.instagram.com/tv/CWbejF6DD9B/?utm_source=ig_web_copy_link"
    # url = "https://www.artstation.com/artwork/CPLicD6K1uv/"
    # url = "CPLicD6K1uv"

    for pattern in patterns:
        match = re.compile(pattern).match(shortcode)
        if match:
            return match.group(1)

    # If we got this far, we couldn't parse the shortcode
    raise ValueError(f"Can't parse shortcode from {shortcode}")


def get_sha1sum(filename: str) -> str:
    """Calculate the SHA-1 hash of a file.

    Reads a file in chunks and calculates its SHA-1 hash digest.

    Args:
        filename: Path to the file to hash.

    Returns:
        Hexadecimal string representation of the SHA-1 hash.
    """

    buffer_size = 65536

    sha1 = hashlib.sha1()

    with open(filename, "rb") as f:
        while True:
            data = f.read(buffer_size)
            if not data:
                break
            sha1.update(data)

    return sha1.hexdigest()


def parse_date(date: str | datetime.datetime) -> str:
    """Extract the date portion from a datetime string.

    Parses a datetime string and returns only the date portion (YYYY-MM-DD).
    If parsing fails, converts the input to a string.
    For timezone-aware datetime objects, extracts the date component
    before any timezone conversion to avoid day-shift issues.

    Args:
        date: A datetime string or datetime object. Example:
            "2021-08-15 23:40:56" or datetime object.

    Returns:
        Date string in YYYY-MM-DD format, or string representation of the
        input if parsing fails.
    """
    # Handle datetime objects directly
    if isinstance(date, datetime.datetime):
        # For timezone-aware datetimes, use the date component directly
        # to avoid timezone conversion issues
        if date.tzinfo is not None:
            # Convert to UTC first, then extract date to avoid day shifts
            utc_date = date.astimezone(datetime.timezone.utc)
            return utc_date.strftime("%Y-%m-%d")
        else:
            # Naive datetime, just extract the date
            return date.strftime("%Y-%m-%d")

    # For strings, try to extract YYYY-MM-DD pattern
    date_str = str(date)
    match = re.match(r"^(\d{4}-\d{2}-\d{2})", date_str)
    if match:
        return match.group(1)

    return date_str


def import_instagram(user: User, parsed_url: ParseResult) -> Blob:
    """Import an Instagram post as a blob.

    Downloads an Instagram post image using the user's Instagram credentials,
    creates a blob with the post caption and metadata, and indexes it in
    Elasticsearch.

    Args:
        user: The user importing the post. Must have Instagram credentials
            configured in their user profile.
        parsed_url: Parsed URL object from urlparse containing the Instagram
            post URL.

    Returns:
        The created Blob instance.

    Raises:
        ValueError: If Instagram credentials are missing, login fails, or
            the post is not found.
        Exception: For other errors during the import process.
    """

    if not user.userprofile.instagram_credentials:
        raise ValueError("Please provide your Instagram credentials in <a href='" + reverse('accounts:prefs') + "'>preferences</a>.")

    loader = instaloader.Instaloader(download_videos=True)

    try:
        loader.login(
            user.userprofile.instagram_credentials["username"],
            user.userprofile.instagram_credentials["password"]
        )
    except Exception as e:
        if str(e).find("Wrong password") != -1:
            raise ValueError("Login error. Please check your Instagram password in <a href='" + reverse('accounts:prefs') + "'>preferences</a>.")
        if str(e).find("does not exist") != -1:
            raise ValueError("Login error. Please check your Instagram username in <a href='" + reverse('accounts:prefs') + "'>preferences</a>.")
        raise Exception(f"{type(e)}: {e}")

    short_code = parse_shortcode(parsed_url.geturl())

    try:
        post = Post.from_shortcode(loader.context, short_code)
    except Exception as e:
        if str(e).find("Fetching Post metadata failed") != -1:
            raise ValueError("Instagram post not found.")
        raise Exception(e)

    o = urlparse(post.url)
    base_name, ext = os.path.splitext(Path(o.path).name)
    temp_file = NamedTemporaryFile(delete=True)

    loader.download_pic(temp_file.name, post.url, post.date_utc)

    # Instaloader adds a file extension to the file path you give
    #  it, whether you want that or not. So I need to rename the
    #  resulting file to match the temp file generated by
    #  NamedTemporaryFile.
    os.rename(f"{temp_file.name}{ext}", temp_file.name)

    date = parse_date(post.date)

    blob = Blob(
        user=user,
        name=post.caption,
        date=date,
        sha1sum=get_sha1sum(temp_file.name)
    )
    setattr(blob, "file_modified", int(os.path.getmtime(temp_file.name)))
    blob.save()

    filename = f"{base_name}{ext}"
    with open(temp_file.name, "rb") as f:
        myfile = File(f)
        blob.file.save(filename, myfile)

    url = f"https://instagram.com/p/{post.shortcode}/"
    artist_name = post.owner_profile.full_name

    MetaData.objects.create(user=user, name="Url", value=url, blob=blob)
    MetaData.objects.create(user=user, name="Artist", value=artist_name, blob=blob)

    blob.index_blob()

    return blob


def import_artstation(user: User, parsed_url: ParseResult) -> Blob:
    """Import an ArtStation artwork as a blob.

    Downloads an ArtStation artwork image, creates a blob with the artwork
    title and metadata, and indexes it in Elasticsearch.

    Args:
        user: The user importing the artwork.
        parsed_url: Parsed URL object from urlparse containing the ArtStation
            artwork URL.

    Returns:
        The created Blob instance.

    Raises:
        ValueError: If the artwork cannot be retrieved or imported.
    """

    short_code = parse_shortcode(parsed_url.geturl())
    url = f"https://www.artstation.com/projects/{short_code}.json"
    result = requests.get(url, timeout=10)

    if not result.ok:
        raise ValueError(f"Error importing image: {result.reason}")

    result = result.json()

    date = parse_date(result["created_at"])

    filename = os.path.basename(urlparse(result["assets"][0]["image_url"]).path)

    opener = urllib.request.build_opener()
    opener.addheaders = [("User-agent", "Bordercore/1.0")]
    urllib.request.install_opener(opener)

    temp_file = NamedTemporaryFile(delete=True)

    urllib.request.urlretrieve(result["assets"][0]["image_url"], temp_file.name)

    blob = Blob(
        user=user,
        name=result["title"],
        date=date,
        sha1sum=get_sha1sum(temp_file.name)
    )
    setattr(blob, "file_modified", int(os.path.getmtime(temp_file.name)))
    blob.save()

    with open(temp_file.name, "rb") as f:
        myfile = File(f)
        blob.file.save(filename, myfile)

    url = result["permalink"]
    artist_name = result["user"]["full_name"]

    MetaData.objects.create(user=user, name="Url", value=url, blob=blob)
    MetaData.objects.create(user=user, name="Artist", value=artist_name, blob=blob)

    blob.index_blob()

    return blob


def get_authors(byline: str) -> list[str]:
    """Parse a byline string and extract a list of author names.

    Handles bylines that may begin with "By " (case-insensitive), use commas
    to separate multiple authors, and use "and" before the final author's
    name (Oxford comma optional).

    Example:
        get_authors("By Michael D. Shear, Aaron Boxerman and Adam Rasgon")
        returns ["Michael D. Shear", "Aaron Boxerman", "Adam Rasgon"]

    Args:
        byline: A byline string containing one or more author names.

    Returns:
        A list of author names, stripped of extra whitespace.
    """

    if byline.lower().startswith("by "):
        byline = byline[3:]  # remove "By "

    # Split on " and " first (last separator)
    parts = byline.rsplit(" and ", 1)

    # If there was an "and", split the first part by comma
    if len(parts) == 2:
        authors = [author.strip() for author in parts[0].split(",")]
        authors.append(parts[1].strip())
    else:
        authors = [author.strip() for author in byline.split(",")]

    return [author for author in authors if author]  # remove any empty strings


def import_newyorktimes(user: User, url: str) -> Blob:
    """Import a New York Times article as a blob.

    Retrieves article metadata from the New York Times API using the user's
    API key, creates a blob with the article headline and metadata (including
    authors, subtitle, and URL), and indexes it in Elasticsearch.

    Args:
        user: The user importing the article. Must have a New York Times
            API key configured in their user profile.
        url: The New York Times article URL to import.

    Returns:
        The created Blob instance.

    Raises:
        ValueError: If the API key is missing, the API returns an error,
            no articles are found, or multiple articles match the URL.
    """

    api_key = user.userprofile.nytimes_api_key
    if not api_key:
        raise ValueError("Please provide your NYTimes API key in <a href='" + reverse('accounts:prefs') + "'>preferences</a>.")

    # Remove any extraneous search-args from the url
    url = url.split("?")[0]

    url = f"https://api.nytimes.com/svc/search/v2/articlesearch.json?api-key={api_key}&fq=url:(\"{url}\")"
    r = requests.get(url, timeout=10)
    result = r.json()

    if result["status"] == "ERROR":
        raise ValueError(f"There was an error retrieving the article: {result['errors']}")

    matches = result["response"]["docs"]

    if not matches:
        raise ValueError("Error: API returned null")

    if len(matches) > 1:
        raise ValueError("Error: found more than one article matching that url")

    if len(matches) == 0:
        raise ValueError("Error: no articles found matching that url")

    date = datetime.datetime.strptime(matches[0]["pub_date"], "%Y-%m-%dT%H:%M:%S%z").strftime("%Y-%m-%d")

    blob = Blob(
        user=user,
        name=matches[0]["headline"]["main"],
        date=date
    )
    blob.save()

    url = matches[0]["web_url"]
    MetaData.objects.create(user=user, name="Url", value=url, blob=blob)

    subtitle = matches[0]["abstract"]
    MetaData.objects.create(user=user, name="Subtitle", value=subtitle, blob=blob)

    author_list = get_authors(matches[0]["byline"]["original"])
    for author in author_list:
        MetaData.objects.create(user=user, name="Author", value=author, blob=blob)

    blob.index_blob()

    return blob


def chatbot(request: HttpRequest, args: dict[str, Any]) -> Generator[str, None, None]:
    """Generate a chatbot response using OpenAI.

    Creates a chatbot response based on the provided context, which can be
    a blob, question, exercise, notes search, or general chat history.
    Streams the response as it is generated.

    Args:
        request: The HTTP request object.
        args: Dictionary containing chatbot parameters:
            - blob_uuid: UUID of a blob to use as context (optional)
            - question_uuid: UUID of a question to answer (optional)
            - exercise_uuid: UUID of an exercise to describe (optional)
            - mode: Chat mode, "notes" for semantic search-based responses
            - chat_history: JSON string of chat history (for general chat)
            - content: User prompt content (when using blob_uuid)

    Yields:
        Chunks of the chatbot response as strings.

    Note:
        Requires OPENAI_API_KEY environment variable to be set. Uses
        the model configured in settings.OPENAI_GPT_MODEL for generating responses.
    """

    model = settings.OPENAI_GPT_MODEL
    messages: list[dict[str, str]] = []
    added_values: list[dict[str, Any]] = []

    if "blob_uuid" in args:
        blob_content = Blob.objects.get(uuid=args["blob_uuid"]).content
        messages = [
            {
                "role": "user",
                "content": f"{args['content']}: Follow all instructions and answer all questions solely based on the following text: {blob_content}"
            }
        ]
    elif "question_uuid" in args:
        question = Question.objects.get(uuid=args["question_uuid"])
        tags = ",".join([x.name for x in question.tags.all()])
        messages = [
            {
                "role": "user",
                "content": f"Assume the following question is tagged with {tags}. Please answer it: {question.question}"
            }
        ]
    elif "exercise_uuid" in args:
        exercise = Exercise.objects.get(uuid=args["exercise_uuid"])
        messages = [
            {
                "role": "user",
                "content": f"Tell me about the strength training exercise '{exercise.name}'. Include a description and talk about proper form and which muscles are targeted."
            }
        ]
    elif args["mode"] == "notes":
        chat_history = json.loads(args["chat_history"])
        prompt = chat_history[-1]["content"]
        results = semantic_search(request, prompt)["hits"]["hits"][0]["_source"]
        text = results["contents"]
        messages = [
            {
                "role": "user",
                "content": f"Answer the following question based ONLY on the following text. Do not use any other source of information. The question is '{prompt}'. The text is '{text}'"
            }
        ]

        added_values.append(
            {
                "choices": [
                    {
                        "delta": {
                            "content": f"\n\n\nSource: [{results['name'] or 'No title'}]({reverse('blob:detail', kwargs={'uuid': results['uuid']})})"
                        }
                    }
                ]
            }
        )
    else:
        chat_history = json.loads(args["chat_history"])
        messages = [{k: v for k, v in d.items() if k != "id"} for d in chat_history]

    client = OpenAI()

    response = client.chat.completions.create(
        model=model,
        messages=messages,  # type: ignore[arg-type]
        stream=True
    )

    for chunk in itertools.chain(response, added_values):  # type: ignore[arg-type]
        # Handle OpenAI response chunks and custom added_values dicts
        if hasattr(chunk, "choices"):
            if chunk.choices and chunk.choices[0].delta.content:  # type: ignore[union-attr]
                yield chunk.choices[0].delta.content  # type: ignore[union-attr]
        elif isinstance(chunk, dict) and "choices" in chunk:
            choice_content = chunk["choices"][0].get("delta", {}).get("content")
            if choice_content:
                yield choice_content


def get_node_to_object_query(node_uuid: str, object_uuid: str, user: User) -> Q:
    """Build a Q expression for finding a node-to-object relationship.

    Creates a Q expression that matches a relationship between a node and
    a related object (blob or bookmark), ensuring both belong to the user.

    Args:
        node_uuid: UUID of the node (Blob or Question).
        object_uuid: UUID of the related object (Blob or Bookmark).
        user: User who owns both the node and object.

    Returns:
        Q expression that can be used with QuerySet.get() or filter().
    """
    return (
        Q(node__uuid=node_uuid, node__user=user)
        & (
            Q(blob__uuid=object_uuid, blob__user=user)
            | Q(bookmark__uuid=object_uuid, bookmark__user=user)
        )
    )


def add_related_object(node_type: str, node_uuid: str, object_uuid: str, user: User) -> dict[str, str]:
    """Relate a node to another object.

    Args:
        node_type: Type of the node (e.g., "blob", "drill").
        node_uuid: UUID of the node.
        object_uuid: UUID of the related object (Blob or Bookmark).
        user: User who owns the node and object.

    Returns:
        dict: Success response with "status" key set to "OK".

    Raises:
        UnsupportedNodeTypeError: If node_type is not supported.
        NodeNotFoundError: If the node is not found.
        RelatedObjectNotFoundError: If the related object is not found.
        ObjectAlreadyRelatedError: If the object is already related.
    """
    # Resolve relation model and derive node model from it
    try:
        relation_model: Any = Blob.get_node_model(node_type)
    except ValueError as e:
        raise UnsupportedNodeTypeError(str(e)) from e

    # Get the node model from the relation model's node ForeignKey
    node_model = relation_model.node.field.related_model
    node = node_model.objects.filter(uuid=node_uuid, user=user).first()
    if not node:
        raise NodeNotFoundError("Node not found")

    # Find the target object (Blob takes precedence)
    target = (
        Blob.objects.filter(uuid=object_uuid, user=user).first()
        or Bookmark.objects.filter(uuid=object_uuid, user=user).first()
    )
    if not target:
        raise RelatedObjectNotFoundError("Related object not found")

    # Derive relation field name from the model's class name
    model_key = target.__class__.__name__.lower()
    relation_kwargs = {model_key: target}

    # get_or_create to simplify exists/create
    _, created = relation_model.objects.get_or_create(
        node=node, **relation_kwargs
    )
    if not created:
        raise ObjectAlreadyRelatedError("That object is already related")

    return {"status": "OK"}
