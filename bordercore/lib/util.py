"""Utility functions for common operations.

This module provides utility functions for Elasticsearch connections, file type
detection, string manipulation, URL parsing, and other common operations used
across the application.
"""
import hashlib
import os
import string
from pathlib import PurePath
from typing import Any
from urllib.parse import urlparse

import requests

ELASTICSEARCH_TIMEOUT = 20


def get_elasticsearch_connection(host: str | None = None, timeout: int = ELASTICSEARCH_TIMEOUT) -> Any:
    """Get an Elasticsearch connection.

    Creates and returns an Elasticsearch connection using the provided host
    or the ELASTICSEARCH_ENDPOINT environment variable.

    Args:
        host: Optional Elasticsearch host endpoint. If not provided, uses
            ELASTICSEARCH_ENDPOINT environment variable or defaults to "localhost".
        timeout: Connection timeout in seconds. Defaults to ELASTICSEARCH_TIMEOUT.

    Returns:
        An Elasticsearch connection object.
    """
    return _get_elasticsearch_connection(host, timeout)


def _get_elasticsearch_connection(host: str | None = None, timeout: int = ELASTICSEARCH_TIMEOUT) -> Any:
    """Internal function to create an Elasticsearch connection.

    Isolates the Elasticsearch imports so other functions from this module
    can be imported without requiring these dependencies.

    Args:
        host: Optional Elasticsearch host endpoint. If not provided, uses
            ELASTICSEARCH_ENDPOINT environment variable or defaults to "localhost".
        timeout: Connection timeout in seconds. Defaults to ELASTICSEARCH_TIMEOUT.

    Returns:
        An Elasticsearch connection object.
    """
    # Isolate the import here so other functions from this module
    #  can be imported without requiring these dependencies.
    from elasticsearch import RequestsHttpConnection
    from elasticsearch_dsl.connections import connections

    if not host:
        host = os.environ.get("ELASTICSEARCH_ENDPOINT", "localhost")

    return connections.create_connection(
        hosts=[host],
        use_ssl=False,
        timeout=timeout,
        connection_class=RequestsHttpConnection,
    )


def get_missing_blob_ids(expected: list[Any], found: dict[str, Any]) -> set[str]:
    """Get set of blob UUIDs missing from Elasticsearch results.

    Compares a list of expected blob objects with Elasticsearch search results
    and returns a set of UUIDs that are in the expected list but not found in
    the Elasticsearch results.

    Args:
        expected: List of blob objects with a uuid attribute.
        found: Elasticsearch search results dictionary with structure:
            {"hits": {"hits": [{"_id": "...", ...}, ...]}}

    Returns:
        Set of missing blob UUIDs, or empty set if none missing.
    """
    found_ids = {x["_id"] for x in found["hits"]["hits"]}

    missing = {str(x.uuid) for x in expected if str(x.uuid) not in found_ids}
    return missing


def get_missing_bookmark_ids(expected: list[Any], found: dict[str, Any]) -> set[str]:
    """Get set of bookmark UUIDs missing from Elasticsearch results.

    Compares a list of expected bookmark objects with Elasticsearch search results
    and returns a set of UUIDs that are in the expected list but not found in
    the Elasticsearch results.

    Args:
        expected: List of bookmark objects with a uuid attribute.
        found: Elasticsearch search results dictionary with structure:
            {"hits": {"hits": [{"_source": {"uuid": "..."}, ...}, ...]}}

    Returns:
        Set of missing bookmark UUIDs, or empty set if none missing.
    """
    found_ids = {x["_source"]["uuid"].split("_")[-1] for x in found["hits"]["hits"]}

    missing = {str(x.uuid) for x in expected if str(x.uuid) not in found_ids}
    return missing


def get_missing_metadata_ids(expected: list[Any], found: dict[str, Any]) -> set[str]:
    """Get set of metadata blob UUIDs missing from Elasticsearch results.

    Compares a list of expected metadata objects with Elasticsearch search results
    and returns a set of blob UUIDs that are in the expected list but not found in
    the Elasticsearch results.

    Args:
        expected: List of metadata objects with a blob attribute that has a uuid attribute.
        found: Elasticsearch search results dictionary with structure:
            {"hits": {"hits": [{"_id": "...", ...}, ...]}}

    Returns:
        Set of missing blob UUIDs, or empty set if none missing.
    """
    found_ids = {hit["_id"] for hit in found["hits"]["hits"]}
    missing = {str(item.blob.uuid) for item in expected if str(item.blob.uuid) not in found_ids}
    return missing


def truncate(text: str, limit: int = 100) -> str:
    """Truncate a string to a specified length with ellipsis.

    Truncates the input string to the specified limit and appends "..." if
    the string was longer than the limit. The ellipsis is only added if there
    is room for it (limit >= 3), ensuring the result never exceeds the limit.

    Args:
        text: The string to truncate.
        limit: Maximum length of the returned string. Must be positive. Defaults to 100.

    Returns:
        Truncated string with "..." appended if original was longer than limit
        and limit >= 3, otherwise just the truncated string.

    Raises:
        ValueError: If limit is not positive.
    """
    if limit <= 0:
        raise ValueError("limit must be positive")

    if len(text) <= limit:
        return text

    # If limit is less than 3, can't fit both text and "...", so just truncate
    if limit < 3:
        return text[:limit]

    # Reserve 3 characters for "...", so truncate to (limit - 3) characters
    return text[:limit - 3] + "..."


def remove_non_ascii_characters(input_string: str, default: str = "") -> str:
    """Remove all non-ASCII characters from a string.

    Filters out all characters that are not in the printable ASCII character set.
    If the entire string consists of non-ASCII characters, returns the default value.

    Args:
        input_string: The string to filter.
        default: Default value to return if the filtered string is empty.
            Defaults to empty string.

    Returns:
        String with non-ASCII characters removed, or the default value if the
        result would be empty.
    """
    output_string = "".join(filter(lambda x: x in string.printable, input_string))

    if not output_string:
        output_string = default

    return output_string


# Putting these functions here rather than in blob/models.py so
#  that AWS lambdas can easily re-use them

def _has_extension(file_path_or_obj: str | Any, extensions: set[str]) -> bool:
    """Check if a file has one of the specified extensions.

    Helper function to check if a file's extension matches any of the provided
    extensions. Handles both file paths and file-like objects.

    Args:
        file_path_or_obj: File path string or file-like object with a name/path attribute.
        extensions: Set of file extensions (without the dot) to check against.

    Returns:
        True if the file extension matches one of the provided extensions, False otherwise.
    """
    if not file_path_or_obj:
        return False

    file_extension = PurePath(str(file_path_or_obj)).suffix
    if not file_extension:
        return False

    return file_extension[1:].lower() in extensions


def is_image(file_path_or_obj: str | Any) -> bool:
    """Check if a file is an image based on its extension.

    Determines if a file is an image by checking if its file extension matches
    common image formats.

    Args:
        file_path_or_obj: File path string or file-like object with a name/path attribute.

    Returns:
        True if the file extension indicates an image format, False otherwise.
    """
    return _has_extension(file_path_or_obj, {"bmp", "gif", "jpg", "jpeg", "png", "tiff"})


def is_pdf(file_path_or_obj: str | Any) -> bool:
    """Check if a file is a PDF based on its extension.

    Determines if a file is a PDF by checking if its file extension is ".pdf".

    Args:
        file_path_or_obj: File path string or file-like object with a name/path attribute.

    Returns:
        True if the file extension is ".pdf", False otherwise.
    """
    return _has_extension(file_path_or_obj, {"pdf"})


def is_video(file_path_or_obj: str | Any) -> bool:
    """Check if a file is a video based on its extension.

    Determines if a file is a video by checking if its file extension matches
    common video formats.

    Args:
        file_path_or_obj: File path string or file-like object with a name/path attribute.

    Returns:
        True if the file extension indicates a video format, False otherwise.
    """
    return _has_extension(file_path_or_obj, {"avi", "flv", "m4v", "mkv", "mp4", "webm"})


def is_audio(file_path_or_obj: str | Any) -> bool:
    """Check if a file is an audio file based on its extension.

    Determines if a file is an audio file by checking if its file extension matches
    common audio formats.

    Args:
        file_path_or_obj: File path string or file-like object with a name/path attribute.

    Returns:
        True if the file extension indicates an audio format, False otherwise.
    """
    return _has_extension(file_path_or_obj, {"mp3", "wav"})


def get_pagination_range(page_number: int, num_pages: int, paginate_by: int | None = None) -> list[int]:
    """Get a range of pages for pagination navigation UI.

    Calculates a range of page numbers to display in a pagination navigation
    component, centered around the current page number. The range extends
    paginate_by pages before and after the current page, adjusted to stay
    within the bounds of available pages.

    Args:
        page_number: The current page number (1-indexed).
        num_pages: The total number of pages in the result set. Must be positive.
        paginate_by: The number of navigation pages to display before
            and after the current page. Defaults to 2 if None. Must be positive.

    Returns:
        List of page numbers to display in the pagination navigation.
        Returns empty list if num_pages is 0 or page_number is out of range.

    Raises:
        ValueError: If num_pages is negative or paginate_by is non-positive.
    """
    if num_pages <= 0:
        return []

    if paginate_by is None:
        paginate_by = 2
    elif paginate_by <= 0:
        raise ValueError("paginate_by must be positive")

    # Clamp page_number to valid range
    page_number = max(1, min(page_number, num_pages))

    # Calculate desired range centered around current page
    start = max(1, page_number - paginate_by)
    end = min(num_pages, page_number + paginate_by) + 1

    # If we're near the start, extend the range to the right
    if start == 1:
        end = min(num_pages + 1, paginate_by * 2 + 2)

    # If we're near the end, extend the range to the left
    if end == num_pages + 1:
        start = max(1, num_pages - paginate_by * 2)

    return list(range(start, end))


def parse_title_from_url(url: str) -> tuple[str, str]:
    """Parse the title from an HTML page at the given URL.

    Fetches the HTML content from the URL and extracts the title tag content.
    Returns the final URL (after any redirects) and the title text.

    Args:
        url: The URL to fetch and parse.

    Returns:
        Tuple containing:
            - The final URL (after redirects)
            - The page title text, or "No title" if no title tag is found.
    """
    # Isolate the import here so other functions from this module
    #  can be imported without requiring these dependencies.
    from lxml import html

    headers = {"user-agent": "Bordercore/1.0"}
    r = requests.get(url, headers=headers, timeout=10)
    http_content = r.text.encode("utf-8")

    # http://stackoverflow.com/questions/15830421/xml-unicode-strings-with-encoding-declaration-are-not-supported
    doc = html.fromstring(http_content)
    title = doc.xpath(".//title")
    if title:
        return (r.url, title[0].text)
    return (r.url, "No title")


def favicon_url(url: str | None, size: int = 32) -> str:
    """Generate an HTML img tag for a favicon from a URL.

    Extracts the domain from the URL and generates an HTML img tag pointing
    to the favicon hosted on bordercore.com. Returns empty string if no URL
    is provided.

    Args:
        url: The URL to extract the domain from. If None or empty, returns
            empty string.
        size: Width and height of the favicon image in pixels. Defaults to 32.

    Returns:
        HTML img tag string for the favicon, or empty string if url is None/empty.
    """
    if not url:
        return ""

    t = urlparse(url).netloc
    
    # Remove port number if present (e.g., localhost:8000 -> localhost)
    if ":" in t:
        t = t.split(":")[0]

    # We want the domain part of the hostname (eg bordercore.com instead of www.bordercore.com)
    # Handle single-component domains (localhost, example) and multi-component domains
    parts = t.split(".")
    if len(parts) <= 2:
        # Single or two-component domain: use as-is (localhost, example.com)
        domain = t
    else:
        # Multi-component domain: strip the first component (www.example.com -> example.com)
        domain = ".".join(parts[1:])

    return f"<img src=\"https://www.bordercore.com/favicons/{domain}.ico\" width=\"{size}\" height=\"{size}\" />"


def get_field(obj: dict[str, Any] | Any, field_name: str) -> Any:
    """Retrieve a field value from an object or dictionary.

    Gets a field value from either a dictionary or a Django-like model instance.
    Special handling for 'tags' field: returns empty list for dicts and extracts
    tag names from model instances.

    Args:
        obj: Either a dictionary or a Django-like model instance with attributes.
        field_name: Name of the field to retrieve.

    Returns:
        The value of the field, None for missing values (except 'tags' which
        returns an empty list for dicts), or a list of tag names for model instances.
    """
    if isinstance(obj, dict):
        return obj.get(field_name, [] if field_name == "tags" else None)

    if field_name == "tags":
        return [x.name for x in obj.tags.all()]

    return getattr(obj, field_name, None)


def calculate_sha1sum(file_like: str | Any, chunk_size: int = 65536) -> str:
    """Calculate SHA1 hash of a file-like object or file path in chunks.

    Reads the file in chunks rather than loading the entire file into memory,
    making it suitable for large files. Supports both file paths and file-like
    objects with a read() method.

    Args:
        file_like: Either a file path string or a file-like object with a read()
            method (e.g., UploadedFile, file handle, Django FileField).
        chunk_size: Size of chunks to read at a time in bytes. Defaults to 65536 (64KB).

    Returns:
        Hexadecimal string representation of the SHA1 hash.

    Examples:
        # With a file path
        sha1 = calculate_sha1sum("/path/to/file.pdf")

        # With a file-like object (e.g., UploadedFile)
        sha1 = calculate_sha1sum(uploaded_file)

        # With a Django FileField
        sha1 = calculate_sha1sum(blob.file)
    """
    hasher = hashlib.sha1()

    if isinstance(file_like, str):
        # File path provided
        with open(file_like, "rb") as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                hasher.update(chunk)
    else:
        # File-like object provided
        # Reset file pointer to beginning if possible
        if hasattr(file_like, "seek"):
            file_like.seek(0)

        while True:
            chunk = file_like.read(chunk_size)
            if not chunk:
                break
            hasher.update(chunk)

        # Reset file pointer to beginning for potential reuse
        if hasattr(file_like, "seek"):
            file_like.seek(0)

    return hasher.hexdigest()
