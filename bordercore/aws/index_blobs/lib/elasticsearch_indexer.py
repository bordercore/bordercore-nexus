"""Elasticsearch indexing pipeline for blobs.

Handles fetching blob metadata from the Bordercore REST API, downloading
file contents from S3, extracting file metadata (content type, page count,
duration), and indexing everything into Elasticsearch. Includes a
monkeypatched merge function to work around date-range field issues in
elasticsearch-dsl.
"""

import base64
import io
import json
import logging
import os
import re
import subprocess
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import PurePath

import boto3
import elasticsearch_dsl
import magic
import requests
from elasticsearch_dsl import DateRange
from elasticsearch_dsl import Document as Document_ES
from elasticsearch_dsl import Integer, Long, Range, Text

try:
    import fitz
except ModuleNotFoundError:
    # Don't worry if this module doesn't exist in production
    pass

from lib.util import get_elasticsearch_connection, is_pdf, is_video

ELASTICSEARCH_INDEX = os.environ.get("ELASTICSEARCH_INDEX", "bordercore")

S3_KEY_PREFIX = "blobs"
S3_BUCKET_NAME = "bordercore-blobs"

DRF_TOKEN = os.environ.get("DRF_TOKEN")

FILE_TYPES_TO_INGEST = [
    "azw3",
    "chm",
    "epub",
    "html",
    "pdf",
    "txt"
]

logging.getLogger().setLevel(logging.INFO)
log = logging.getLogger(__name__)


def elasticsearch_merge(data, new_data, raise_on_conflict=False):
    """Monkeypatched version of elasticsearch_dsl.utils.merge().

    Works around an issue when indexing documents with date_range fields
    by short-circuiting when ``new_data`` is a Range instance and by
    skipping recursive merging into Range values.

    Args:
        data: The existing mapping/AttrDict to merge into.
        new_data: The new mapping/AttrDict to merge from.
        raise_on_conflict: If True, raise ValueError when the same key
            exists in both dicts with different values.

    Raises:
        ValueError: If ``data`` and ``new_data`` are not both mappings,
            or if ``raise_on_conflict`` is True and conflicting values
            are found.
    """
    import collections.abc as collections_abc

    from elasticsearch_dsl.utils import AttrDict
    from elasticsearch_dsl.wrappers import Range
    from six import iteritems

    if not (
        isinstance(data, (AttrDict, collections_abc.Mapping))
        and isinstance(new_data, (AttrDict, collections_abc.Mapping))
    ):
        raise ValueError(
            "You can only merge two dicts! Got {!r} and {!r} instead.".format(
                data, new_data
            )
        )

    if isinstance(new_data, Range):
        return

    for key, value in iteritems(new_data):
        if (
            key in data
            and isinstance(data[key], (AttrDict, collections_abc.Mapping))
            and isinstance(value, (AttrDict, collections_abc.Mapping))
            and not isinstance(value, Range)
        ):
            elasticsearch_merge(data[key], value, raise_on_conflict)
        elif key in data and data[key] != value and raise_on_conflict:
            raise ValueError("Incompatible data for key %r, cannot be merged." % key)
        else:
            data[key] = value


class ESBlob(Document_ES):
    """Elasticsearch DSL document representing an indexed blob.

    Maps blob fields (uuid, name, tags, file contents, etc.) to an
    Elasticsearch index.  Used by ``index_blob`` to persist blob data
    for full-text search.

    Attributes:
        uuid: Unique identifier for the blob.
        bordercore_id: Numeric primary key from the Bordercore database.
        sha1sum: SHA-1 hash of the blob's file contents.
        user_id: ID of the owning user.
        date: User-supplied date or date range for the blob.
        name: Human-readable name/title.
        contents: Extracted text content of the blob.
        doctype: Document type (note, book, blob, or document).
        tags: Tags associated with the blob.
        filename: Original filename of the uploaded file.
        note: Free-form note attached to the blob.
        url: Associated URL, if any.
        importance: User-assigned importance ranking.
        date_unixtime: Unix timestamp derived from ``date``.
        created_date: Timestamp when the blob was created.
        last_modified: Timestamp when the blob was last modified.
    """

    uuid = Text()
    bordercore_id = Long()
    sha1sum = Text()
    user_id = Integer()
    date = DateRange()
    name = Text()
    contents = Text()
    doctype = Text()
    tags = Text()
    filename = Text()
    note = Text()
    url = Text()
    importance = Integer()
    date_unixtime = Long()
    created_date = Text()
    last_modified = Text()

    class Index:
        name = ELASTICSEARCH_INDEX


def get_doctype(blob, metadata):
    """Determine the document type based on blob properties and metadata.

    Args:
        blob: Dict of blob fields from the Bordercore REST API.
        metadata: Dict of extracted metadata key-value pairs.

    Returns:
        A string indicating the document type: ``"note"``, ``"book"``,
        ``"blob"``, or ``"document"``.
    """
    if blob["is_note"] is True:
        return "note"
    elif "is_book" in metadata:
        return "book"
    elif blob["sha1sum"] is not None:
        return "blob"
    else:
        return "document"


def is_ingestible_file(filename):
    """Check if a file type should be ingested by the ES attachment pipeline.

    Compares the file's extension against ``FILE_TYPES_TO_INGEST`` to decide
    whether the file contents should be sent through the Elasticsearch
    attachment ingest pipeline for full-text extraction.

    Args:
        filename: Filename or path whose extension will be checked.

    Returns:
        True if the file extension is in ``FILE_TYPES_TO_INGEST``,
        False otherwise.
    """
    file_extension = PurePath(str(filename)).suffix
    if file_extension[1:].lower() in FILE_TYPES_TO_INGEST:
        return True
    else:
        return False


def get_blob_info(**kwargs):
    """Fetch blob info from the Bordercore REST API by sha1sum or uuid.

    Makes an authenticated GET request to the Bordercore REST API and
    returns the blob's fields with metadata extracted into a separate
    dict.

    Args:
        **kwargs: Must contain either ``sha1sum`` or ``uuid`` to
            identify the blob.

    Returns:
        A dict of blob fields from the API response, with a
        ``metadata`` key containing a dict whose values are lists
        of metadata values keyed by lowercase metadata names.

    Raises:
        ValueError: If neither ``sha1sum`` nor ``uuid`` is provided.
        Exception: If the API returns a non-200 status code.
    """
    if "sha1sum" in kwargs:
        prefix = "sha1sums"
        param = kwargs["sha1sum"]
    elif "uuid" in kwargs:
        prefix = "blobs"
        param = kwargs["uuid"]
    else:
        raise ValueError("Must pass in uuid or sha1sum")

    headers = {"Authorization": f"Token {DRF_TOKEN}"}

    session = requests.Session()

    # Ignore .netrc files. Useful for local debugging.
    session.trust_env = False
    r = session.get(f"https://www.bordercore.com/api/{prefix}/{param}/", headers=headers)

    if r.status_code != 200:
        raise Exception(f"Error when accessing Bordercore REST API: status code={r.status_code}, prefix={prefix}, param={param}")

    info = r.json()

    # Extract the blob's metadata and store it separately, since it will
    #  be indexed in its own Elasticsearch field
    metadata = {}

    for x in info["metadata"]:
        for key, value in x.items():
            if not key or not value:
                continue
            existing = metadata.get(key.lower(), [])
            existing.append(value)
            metadata[key.lower()] = existing

    # Now that we have a separate copy, remove the blob's metadata from the main object
    info.pop("metadata", None)

    return {
        **info,
        "metadata": metadata
    }


def get_blob_contents_from_s3(blob):
    """Download a blob's file contents from S3.

    Constructs the S3 key from the blob's uuid and filename, then
    downloads the object from the ``bordercore-blobs`` bucket.

    Args:
        blob: Dict containing ``uuid`` and ``file`` keys used to
            build the S3 object key.

    Returns:
        The raw file contents as bytes.
    """
    blob_contents = BytesIO()
    s3_key = f'{S3_KEY_PREFIX}/{blob["uuid"]}/{blob["file"]}'
    s3_client = boto3.client("s3")
    s3_client.download_fileobj(S3_BUCKET_NAME, s3_key, blob_contents)

    blob_contents.seek(0)
    return blob_contents.read()


def get_unixtime_from_string(date):
    """Parse a date string in various formats to a Unix timestamp.

    Supported formats:
        - ``YYYY-MM-DD HH:MM:SS``
        - ``YYYY-MM-DD``
        - ``YYYY-MM`` (day defaults to 01)
        - ``YYYY`` (month and day default to 01)
        - ``[YYYY-MM TO YYYY-MM]`` (uses the start of the range)

    Args:
        date: A date string in one of the supported formats, or
            None/empty string.

    Returns:
        A Unix timestamp string, or None if ``date`` is None or empty.

    Raises:
        ValueError: If the date string does not match any supported
            format.
    """
    if date is None or date == "":
        return None

    return_date = None

    if re.search(r"^\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d$", date):
        return_date = datetime.strptime(date, "%Y-%m-%d %H:%M:%S").strftime("%s")
    elif re.search(r"^\d\d\d\d-\d\d-\d\d$", date):
        return_date = datetime.strptime(date, "%Y-%m-%d").strftime("%s")
    elif re.search(r"^\d\d\d\d-\d\d$", date):
        return_date = datetime.strptime(f"{date}-01", "%Y-%m-%d").strftime("%s")
    elif re.search(r"^\d\d\d\d$", date):
        return_date = datetime.strptime(f"{date}-01-01", "%Y-%m-%d").strftime("%s")
    else:

        m = re.search(r"^\[(\d\d\d\d-\d\d) TO \d\d\d\d-\d\d\]$", date)
        if m:
            year_month = m.group(1)
            return_date = datetime.strptime(f"{year_month}-01", "%Y-%m-%d").strftime("%s")
        else:
            raise ValueError(f"Date format not recognized: {date}")

    return return_date


def get_range_from_date(date):
    """Convert a date string to an Elasticsearch DateRange.

    If the string is in ``[YYYY-MM TO YYYY-MM]`` range format, the
    returned Range spans from the start month to the end month.
    Otherwise the Range covers a single point (gte == lte).

    Args:
        date: A date string, optionally in ``[YYYY-MM TO YYYY-MM]``
            range format.

    Returns:
        An ``elasticsearch_dsl.wrappers.Range`` instance suitable for
        a DateRange field.
    """
    m = re.search(r"^\[(\d\d\d\d-\d\d) TO (\d\d\d\d-\d\d)\]$", date)
    if m:
        range = Range(gte=m.group(1), lte=m.group(2))
    else:
        range = Range(gte=date, lte=date)

    return range


def get_duration(filename):
    """Get the duration of a video file using ffprobe.

    Shells out to ``ffprobe`` to read the container-level duration
    metadata from the given file.

    Args:
        filename: Path to the video file on disk.

    Returns:
        The duration in seconds as a float.
    """
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            filename
        ],
        capture_output=True
    )

    return float(result.stdout)


def get_num_pages(content):
    """Count the number of pages in a PDF from its raw bytes.

    Uses PyMuPDF (``fitz``) to open the PDF in memory and read the
    page count.

    Args:
        content: The PDF file contents as bytes.

    Returns:
        The number of pages in the PDF as an int.
    """
    doc = fitz.open("pdf", io.BytesIO(content))
    return doc.page_count


def delete_metadata(es, uuid):
    """Delete the metadata field from a blob's Elasticsearch document.

    Executes an ``update_by_query`` with a Painless script to remove
    the ``metadata`` field from the document matching the given uuid.

    Args:
        es: An Elasticsearch client instance.
        uuid: The uuid of the blob whose metadata should be removed.
    """
    q = {
        "query": {
            "term": {
                "uuid": uuid
            }
        },
        "script": {
            "source": "ctx._source.remove(\"metadata\")",
            "lang": "painless"
        }
    }

    es.update_by_query(body=q, index=ELASTICSEARCH_INDEX)


def create_embeddings(uuid):
    """Invoke the CreateEmbeddings Lambda function asynchronously.

    Sends an async (``Event``) invocation to the ``CreateEmbeddings``
    AWS Lambda function with the blob's uuid so that vector embeddings
    can be generated for its content.

    Args:
        uuid: The uuid of the blob to generate embeddings for.
    """
    lambda_client = boto3.client("lambda")
    lambda_client.invoke(
        FunctionName="CreateEmbeddings",
        InvocationType="Event",
        Payload=json.dumps({"uuid": uuid})
    )


def is_image_blob(content_type: str | None) -> bool:
    """Return True if the blob is an image we should embed with CLIP."""
    return bool(content_type) and content_type.startswith("image/")


def create_image_embedding(uuid: str) -> None:
    """Invoke the CreateImageEmbedding Lambda asynchronously for this blob."""
    lambda_client = boto3.client("lambda")
    lambda_client.invoke(
        FunctionName="CreateImageEmbedding",
        InvocationType="Event",
        Payload=json.dumps({"mode": "index", "uuid": uuid}),
    )


def index_blob(**kwargs):
    """Full blob indexing pipeline: fetch info, download from S3, index in ES.

    Orchestrates the end-to-end indexing of a single blob. Retrieves
    blob metadata from the Bordercore REST API, optionally downloads
    file contents from S3, detects content type and extracts file
    metadata (page count, video duration), and saves the resulting
    Elasticsearch document. For metadata-only updates, uses an upsert
    with the monkeypatched merge to handle date-range fields.

    Args:
        **kwargs: Must contain either ``sha1sum`` or ``uuid`` to
            identify the blob. Optional keys include:

            - ``create_connection`` (bool): Whether to create an ES
              connection. Defaults to True.
            - ``extra_fields`` (dict): Additional fields to include
              in the indexed document.
            - ``file_changed`` (bool): Whether the file itself changed.
              Defaults to True. When False, only metadata is updated.
            - ``new_blob`` (bool): Whether this is a new blob. Defaults
              to True. When False and ``file_changed`` is also False,
              existing metadata is deleted before upserting.
    """
    es = None
    if kwargs.get("create_connection", True):
        es = get_elasticsearch_connection()

    blob_info = get_blob_info(**kwargs)

    extra_fields = {}
    if "extra_fields" in kwargs:
        extra_fields = kwargs["extra_fields"]

    # An empty string causes a Python datetime validation error,
    #  so convert to "None" to avoid this.
    if blob_info["date"] == "":
        blob_info["date"] = None

    fields = dict(
        uuid=blob_info["uuid"],
        bordercore_id=blob_info["id"],
        sha1sum=blob_info["sha1sum"],
        user_id=blob_info["user"]["id"],
        name=blob_info["name"],
        contents=blob_info["content"],
        doctype=get_doctype(blob_info, blob_info["metadata"]),
        tags=blob_info["tags"],
        filename=str(blob_info["file"]),
        note=blob_info["note"],
        importance=blob_info["importance"],
        date_unixtime=get_unixtime_from_string(blob_info["date"]),
        created_date=blob_info["created"],
        last_modified=blob_info["modified"],
        metadata=blob_info["metadata"],
        **extra_fields
    )

    if blob_info["date"] is not None:
        fields["date"] = get_range_from_date(blob_info["date"])

    article = ESBlob(**fields)
    article.meta.id = blob_info["uuid"]

    pipeline_args = {}

    # If only the metadata has changed and not the file itself,
    #  don't bother re-indexing the file. Upsert the metadata.
    file_changed = kwargs.get("file_changed", True)
    log.info(f"file_changed: {file_changed}")

    if blob_info["sha1sum"] and file_changed:

        log.info("ingesting the blob")
        # Even if this is not an ingestible file, we need to download the blob
        #  in order to determine the content type
        contents = get_blob_contents_from_s3(blob_info)

        article.size = len(contents)
        log.info(f"Size: {article.size}")

        # Dump the blob contents to a file. We do this rather than process in
        #  memory because some large blobs are too big to handle this way.
        EFS_DIR = os.environ.get("EFS_DIR", "/tmp/blobs")
        filename = f"{EFS_DIR}/{uuid.uuid4()}-{str(blob_info['file'])}"
        with open(filename, "wb") as file:
            newFileByteArray = bytearray(contents)
            file.write(newFileByteArray)

        article.content_type = magic.from_file(filename, mime=True)

        if is_video(blob_info["file"]):
            try:
                article.duration = get_duration(filename)
                log.info(f"Video duration: {article.duration}")
            except Exception as e:
                log.error(f"Exception determing video duration: {e}")

        os.remove(filename)

        if is_pdf(blob_info["file"]):
            try:
                article.num_pages = get_num_pages(contents)
                log.info(f"Number of pages: {article.num_pages}")
            except (TypeError, ValueError):
                # A pdf read failure can be caused by many
                #  things. Ignore any such failures.
                pass

        if is_ingestible_file(blob_info["file"]):
            pipeline_args = dict(pipeline="attachment")
            article.data = base64.b64encode(contents).decode("ascii")

        article.save(**pipeline_args)

    else:
        if not kwargs.get("new_blob", True):
            # For existing blobs, remove any existing metadata first before updating,
            #  in case the user is deleting some of it.
            delete_metadata(es, article.uuid)

        # Monkeypatch Elasticsearch DSL to avoid issue with date ranges
        elasticsearch_dsl.utils.merge = elasticsearch_merge

        article.update(doc_as_upsert=True, **fields)

    if "content" in blob_info:
        create_embeddings(blob_info["uuid"])

    if is_image_blob(getattr(article, "content_type", None)):
        create_image_embedding(blob_info["uuid"])
