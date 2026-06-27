#!/usr/bin/env python
"""Generate an AI thumbnail using Gemini image generation.

For bookmarks, extracts article text from the bookmark's URL via trafilatura.
For blobs, uses the blob's text contents. For collections, summarizes the
collection metadata and contents. Then uses Google's Gemini 2.5 Flash image
model to create a content-aware thumbnail. The resulting image is saved locally
as a compressed JPEG.

Usage:
    python bin/generate_ai_thumbnail.py -t bookmark <bookmark-uuid>
    python bin/generate_ai_thumbnail.py -t blob <blob-uuid>
    python bin/generate_ai_thumbnail.py -t collection <collection-uuid>
    python bin/generate_ai_thumbnail.py -t c <collection-uuid>

Requires GEMINI_API_KEY environment variable to be set.
"""
import argparse
import asyncio
import io
import os
import sys

import django

django.setup()

from django.db import connections  # noqa: E402
import requests  # noqa: E402
import trafilatura  # noqa: E402
from google import genai  # noqa: E402
from google.genai import types  # noqa: E402
from PIL import Image  # noqa: E402

from blob.models import Blob  # noqa: E402
from bookmark.models import Bookmark  # noqa: E402
from collection.models import Collection  # noqa: E402

COLLECTION_ITEM_LIMIT = 12
SIZE_PRESETS = {
    "small": 480,
    "medium": 1024,
    "large": 1536,
    "original": None,
}


def close_database_pools() -> None:
    """Close Django DB connections and psycopg pools opened by the script."""
    for alias in list(connections):
        connection = connections[alias]
        close_pool = getattr(connection, "close_pool", None)
        if callable(close_pool):
            try:
                close_pool()
            except Exception:
                pass
    connections.close_all()


def extract_article_text(url: str) -> str | None:
    """Fetch a URL and extract its article text using trafilatura."""
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"Error fetching URL: {e}")
        return None

    config = trafilatura.settings.use_config()
    config.set("DEFAULT", "EXTRACTION_TIMEOUT", "10")

    return trafilatura.extract(
        response.text, config=config, include_comments=False, include_tables=False
    )


def get_text_excerpt(text: str, max_paragraphs: int = 3, max_chars: int = 800) -> str:
    """Return the first few paragraphs of text, capped at max_chars."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    excerpt = "\n\n".join(paragraphs[:max_paragraphs])
    if len(excerpt) > max_chars:
        excerpt = excerpt[:max_chars].rsplit(" ", 1)[0] + "..."
    return excerpt


def get_short_text(text: str, max_chars: int = 220) -> str:
    """Return a compact single-line summary string."""
    compact = " ".join(text.split())
    if len(compact) > max_chars:
        compact = compact[:max_chars].rsplit(" ", 1)[0] + "..."
    return compact


def build_bookmark_prompt(bookmark: Bookmark) -> str | None:
    """Build an image-generation prompt for a bookmark."""
    print(f"Bookmark: {bookmark.name}")
    print(f"URL: {bookmark.url}")

    print("Extracting article text...")
    text = extract_article_text(bookmark.url)
    if not text:
        print("Error: Could not extract text from URL")
        return None

    excerpt = get_text_excerpt(text)
    print(f"Extracted {len(excerpt)} chars of text")

    return (
        "Create a visually striking, artistic thumbnail image that captures "
        "the essence of this article. The image should be vivid, expressive, "
        "and suitable as a cover image. Do not include any text or words in "
        f"the image.\n\nArticle excerpt:\n{excerpt}"
    )


def build_blob_prompt(blob: Blob) -> str | None:
    """Build an image-generation prompt for a text blob."""
    print(f"Blob: {blob.name or 'Untitled'}")

    text = blob.content.strip()
    if not text:
        print("Error: Blob has no text content to generate an image from")
        return None

    excerpt = get_text_excerpt(text, max_paragraphs=6, max_chars=1600)
    tags = ", ".join(blob.tags.values_list("name", flat=True))
    context_parts = [f"Blob title: {blob.name or 'Untitled'}"]
    if tags:
        context_parts.append(f"Tags: {tags}")
    if blob.note:
        context_parts.append(f"Note: {get_short_text(blob.note, 500)}")
    context_parts.append(f"Text excerpt:\n{excerpt}")

    print(f"Using {len(excerpt)} chars of blob text")

    return (
        "Create a visually striking cover image for this text note or document. "
        "The image should capture the central ideas and mood of the content, "
        "like an editorial illustration or book cover. Do not include any text, "
        "letters, numbers, UI, logos, or words in the image.\n\n"
        + "\n\n".join(context_parts)
    )


def collection_item_summary(collection: Collection) -> list[str]:
    """Return concise descriptions of the first items in a collection."""
    objects = (
        collection.collectionobject_set.select_related("blob", "bookmark")
        .prefetch_related("blob__tags", "bookmark__tags")
        .all()[:COLLECTION_ITEM_LIMIT]
    )
    summaries = []
    for obj in objects:
        if obj.blob is not None:
            blob = obj.blob
            tags = ", ".join(blob.tags.values_list("name", flat=True)[:3])
            details = get_short_text(blob.note or blob.content or "")
            line = f"- Blob: {blob.name or 'Untitled'}"
        elif obj.bookmark is not None:
            bookmark = obj.bookmark
            tags = ", ".join(bookmark.tags.values_list("name", flat=True)[:3])
            details = get_short_text(bookmark.note or bookmark.url or "")
            line = f"- Bookmark: {bookmark.name}"
        else:
            continue

        if tags:
            line += f" | tags: {tags}"
        if details:
            line += f" | notes: {details}"
        summaries.append(line)
    return summaries


def build_collection_prompt(collection: Collection) -> str:
    """Build an image-generation prompt for a collection."""
    print(f"Collection: {collection.name}")
    tags = ", ".join(collection.tags.values_list("name", flat=True))
    item_summaries = collection_item_summary(collection)

    context_parts = [f"Collection name: {collection.name}"]
    if collection.description:
        context_parts.append(f"Description: {get_short_text(collection.description, 600)}")
    if tags:
        context_parts.append(f"Tags: {tags}")
    if item_summaries:
        context_parts.append("Representative contents:\n" + "\n".join(item_summaries))

    return (
        "Create a cohesive, visually striking cover image for this personal "
        "knowledge collection. It should feel like a curated poster or album "
        "cover for the collection's theme, synthesizing the contents into one "
        "image rather than making a collage. Do not include any text, letters, "
        "numbers, UI, logos, or words in the image.\n\n"
        + "\n\n".join(context_parts)
    )


def generate_thumbnail(prompt: str, api_key: str) -> bytes | None:
    """Call Gemini to generate a thumbnail image from the prompt."""
    client = genai.Client(api_key=api_key)
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            ),
        )
    finally:
        client.close()
        asyncio.run(client.aio.aclose())

    for part in response.parts:
        if part.inline_data is not None:
            return part.inline_data.data

    return None


def save_thumbnail(
    uuid: str,
    image_bytes: bytes,
    max_size: int | None = SIZE_PRESETS["small"],
    quality: int = 70,
) -> str:
    """Resize and compress the image, then save locally as JPEG."""
    img = Image.open(io.BytesIO(image_bytes))
    if max_size is not None:
        img.thumbnail((max_size, max_size))
    if img.mode != "RGB":
        img = img.convert("RGB")

    output_path = f"{uuid}.jpg"
    img.save(output_path, "JPEG", quality=quality, optimize=True)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate an AI thumbnail for a bookmark, blob, or collection"
    )
    parser.add_argument(
        "-t",
        "--type",
        required=True,
        choices=("bookmark", "blob", "collection", "c"),
        help="Object type to generate a thumbnail for",
    )
    parser.add_argument(
        "-s",
        "--size",
        default="small",
        choices=tuple(SIZE_PRESETS.keys()),
        help="Output size preset. 'original' saves Gemini's returned dimensions without downscaling.",
    )
    parser.add_argument("uuid", help="Object UUID")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is not set")
        sys.exit(1)

    if args.type == "bookmark":
        try:
            obj = Bookmark.objects.get(uuid=args.uuid)
        except Bookmark.DoesNotExist:
            print(f"Error: No bookmark found with UUID {args.uuid}")
            sys.exit(1)
        prompt = build_bookmark_prompt(obj)
    elif args.type == "blob":
        try:
            obj = Blob.objects.get(uuid=args.uuid)
        except Blob.DoesNotExist:
            print(f"Error: No blob found with UUID {args.uuid}")
            sys.exit(1)
        prompt = build_blob_prompt(obj)
    else:
        try:
            obj = Collection.objects.get(uuid=args.uuid)
        except Collection.DoesNotExist:
            print(f"Error: No collection found with UUID {args.uuid}")
            sys.exit(1)
        prompt = build_collection_prompt(obj)

    if not prompt:
        sys.exit(1)

    # Generate thumbnail
    print("Generating AI thumbnail...")
    image_bytes = generate_thumbnail(prompt, api_key)
    if not image_bytes:
        print("Error: Gemini did not return an image")
        sys.exit(1)

    print(f"Generated image: {len(image_bytes)} bytes")

    # Save locally
    output_path = save_thumbnail(str(obj.uuid), image_bytes, max_size=SIZE_PRESETS[args.size])
    file_size = os.path.getsize(output_path)
    print(f"Done! Saved to {output_path} ({file_size // 1024} KB)")


if __name__ == "__main__":
    try:
        main()
    finally:
        close_database_pools()
