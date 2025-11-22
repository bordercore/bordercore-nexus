import hashlib
import os
import string
from pathlib import PurePath
from typing import Any, Dict, Union
from urllib.parse import urlparse

import requests

ELASTICSEARCH_TIMEOUT = 20


def get_elasticsearch_connection(host=None, timeout=ELASTICSEARCH_TIMEOUT):
    return _get_elasticsearch_connection(host, timeout)


def _get_elasticsearch_connection(host=None, timeout=ELASTICSEARCH_TIMEOUT):

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
        verify_certs=True,
        connection_class=RequestsHttpConnection,
    )


def get_missing_blob_ids(expected, found):

    found_ids = [x["_id"] for x in found["hits"]["hits"]]

    missing = [str(x.uuid) for x in expected if str(x.uuid) not in found_ids]
    return ", ".join(missing)


def get_missing_bookmark_ids(expected, found):

    found_ids = [x["_source"]["uuid"].split("_")[-1] for x in found["hits"]["hits"]]

    missing = [str(x.uuid) for x in expected if str(x.uuid) not in found_ids]
    return missing


def get_missing_metadata_ids(expected, found):

    found_ids = {hit["_id"] for hit in found["hits"]["hits"]}
    missing = {str(item.blob.uuid) for item in expected if str(item.blob.uuid) not in found_ids}
    return ", ".join(missing)


def truncate(string, limit=100):

    return string[:limit] + ("..." if len(string) > limit else "")


def remove_non_ascii_characters(input_string, default="Default"):
    """
    Remove all non ASCII characters from string. If the entire string consists
    of non ASCII characters, return the "default" value.
    """

    output_string = "".join(filter(lambda x: x in string.printable, input_string))

    if not output_string:
        output_string = default

    return output_string


# Putting these functions here rather than in blob/models.py so
#  that AWS lambdas can easily re-use them

def is_image(file):

    if file:
        file_extension = PurePath(str(file)).suffix
        if file_extension[1:].lower() in ["bmp", "gif", "jpg", "jpeg", "png", "tiff"]:
            return True
    return False


def is_pdf(file):

    if file:
        file_extension = PurePath(str(file)).suffix
        if file_extension[1:].lower() in ["pdf"]:
            return True
    return False


def is_video(file):

    if file:
        file_extension = PurePath(str(file)).suffix
        if file_extension[1:].lower() in ["avi", "flv", "m4v", "mkv", "mp4", "webm"]:
            return True
    return False


def is_audio(file):

    if file:
        file_extension = PurePath(str(file)).suffix
        if file_extension[1:].lower() in ["mp3", "wav"]:
            return True
    return False


def get_pagination_range(page_number, num_pages, paginate_by):
    """
    Get a range of pages based on the current page and the maximum number
    of pages, used for a navigation UI.

    page_number: the current page number
    num_pages: the total number of pages in the result set
    paginate_by: the number of navigation pages to display before
                 and after the current page
    """

    # The maximum range is twice the "paginate_by" value plus 1, the current page.
    # If this exceeds the total number of pages, use that instead.
    max_range = min(num_pages, paginate_by * 2 + 1)

    # Try to create a range that extends below and above the current
    #  page by "paginate_by" number of pages.
    x = range(page_number - paginate_by, page_number + paginate_by + 1)

    if x[0] <= 0:
        # If the lower bound is below zero, create a new range that begins at one
        # and extends out to max_range or the number of pages, whichever is smaller.
        x = range(1, min(max_range, num_pages) + 1)

    if x[-1] - (paginate_by - 1) >= num_pages:
        # If the upper bound exceeds the number of pages, create a new range that
        # extends out to max_range or the number of pages, whichever is larger.
        x = range(max(1, x[0] - paginate_by), max(max_range, num_pages + 1))

    return list(x)


def parse_title_from_url(url):

    # Isolate the import here so other functions from this module
    #  can be imported without requiring these dependencies.
    from lxml import html

    headers = {"user-agent": "Bordercore/1.0"}
    r = requests.get(url, headers=headers)
    http_content = r.text.encode("utf-8")

    # http://stackoverflow.com/questions/15830421/xml-unicode-strings-with-encoding-declaration-are-not-supported
    doc = html.fromstring(http_content)
    title = doc.xpath(".//title")
    if title:
        return (r.url, title[0].text)
    return (r.url, "No title")


def favicon_url(url, size=32):

    if not url:
        return ""

    t = urlparse(url).netloc

    # We want the domain part of the hostname (eg bordercore.com instead of www.bordercore.com)
    domain = ".".join(t.split(".")[1:])

    return f"<img src=\"https://www.bordercore.com/favicons/{domain}.ico\" width=\"{size}\" height=\"{size}\" />"


def get_field(obj: Union[Dict[str, Any], Any], field_name: str) -> Any:
    """
    Retrieve a field value from an object or dict. Special handling for 'tags'.

    Args:
        obj: Either a dictionary or a Django-like model instance.
        field_name: Name of the field to retrieve.

    Returns:
        The value of the field, or None/empty list for missing values.
    """
    if isinstance(obj, dict):
        return obj.get(field_name, [] if field_name == "tags" else None)

    if field_name == "tags":
        return [x.name for x in obj.tags.all()]

    return getattr(obj, field_name, None)


def calculate_sha1sum(file_like: Union[str, Any], chunk_size: int = 65536) -> str:
    """
    Calculate SHA1 hash of a file-like object or file path in chunks to avoid memory issues.

    This function reads the file in chunks rather than loading the entire file into memory,
    making it suitable for large files.

    Args:
        file_like: Either a file path string or a file-like object with a read() method
            (e.g., UploadedFile, file handle, Django FileField).
        chunk_size: Size of chunks to read at a time (default: 65536 bytes = 64KB).

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
