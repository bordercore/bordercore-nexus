"""Embedding utilities using the OpenAI Python client.

This module provides functions for creating embeddings using OpenAI's API,
including utilities for handling long text by chunking, normalizing vectors,
and computing weighted averages of embeddings.
"""

import math
import os
from collections.abc import Generator, Iterable, Sequence
from itertools import islice
from typing import Any

import tiktoken
from openai import OpenAI

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_CTX_LENGTH = 8191
EMBEDDING_ENCODING = "cl100k_base"
NOTE_CHUNK_TOKENS = 400
NOTE_CHUNK_OVERLAP = 60


def build_blob_embedding_text(
    content: str,
    *,
    name: str = "",
    tags: Iterable[str] | None = None,
) -> str:
    """Compose embedding input from a blob title, tags, and body.

    Title and tags are prepended so semantic search can match notes by name
    or tag even when the body omits those terms.

    Args:
        content: Blob body text.
        name: Blob display name / title.
        tags: Tag names associated with the blob.

    Returns:
        Combined text for :func:`len_safe_get_embedding`, or an empty string
        when title, tags, and body are all empty.
    """
    parts: list[str] = []
    title = (name or "").strip()
    if title:
        parts.append(f"Title: {title}")
    tag_names = sorted({str(tag).strip() for tag in (tags or []) if str(tag).strip()})
    if tag_names:
        parts.append(f"Tags: {', '.join(tag_names)}")
    body = (content or "").strip()
    if body:
        parts.append(body)
    return "\n\n".join(parts)


def get_embedding(
    text_or_tokens: str | Sequence[int],
    model: str = EMBEDDING_MODEL,
) -> list[float]:
    """Create a single embedding and return its vector.

    Args:
        text_or_tokens: Text string or sequence of token IDs to embed.
        model: OpenAI embedding model to use. Defaults to EMBEDDING_MODEL.

    Returns:
        List of floats representing the embedding vector.
    """
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    response = client.embeddings.create(
        input=text_or_tokens,
        model=model,
    )
    # New SDK returns a typed object, not a dict
    return response.data[0].embedding


def batched(iterable: Iterable, n: int) -> Generator[tuple, None, None]:
    """Batch data into tuples of length n. The last batch may be shorter.

    Args:
        iterable: Iterable to batch.
        n: Size of each batch.

    Yields:
        Tuples of length n (or shorter for the last batch).

    Raises:
        ValueError: If n is less than 1.
    """
    # batched("ABCDEFG", 3) --> ABC DEF G
    if n < 1:
        raise ValueError("n must be at least one")
    it = iter(iterable)
    while (batch := tuple(islice(it, n))):
        yield batch


def chunked_tokens(
    text: str,
    encoding_name: str,
    chunk_length: int,
) -> Generator[tuple[int, ...], None, None]:
    """Chunk text into token sequences of specified length.

    Args:
        text: Text string to chunk.
        encoding_name: Name of the tiktoken encoding to use.
        chunk_length: Maximum number of tokens per chunk.

    Yields:
        Tuples of token IDs, each tuple representing a chunk.
    """
    encoding = tiktoken.get_encoding(encoding_name)
    tokens = encoding.encode(text)
    chunks_iterator = batched(tokens, chunk_length)
    yield from chunks_iterator


def normalize(vec: list[float]) -> list[float]:
    """Normalize a vector to unit length.

    Args:
        vec: Vector to normalize.

    Returns:
        Normalized vector (unit length), or original vector if norm is zero.
    """
    norm = math.sqrt(sum(x * x for x in vec))
    return [x / norm for x in vec] if norm > 0 else vec


def weighted_average(vectors: list[list[float]], weights: list[int]) -> list[float]:
    """Compute a weighted average of multiple vectors.

    Args:
        vectors: List of vectors to average.
        weights: List of weights corresponding to each vector.

    Returns:
        Weighted average vector.
    """
    total_weight = sum(weights)
    dim = len(vectors[0])
    result = [0.0] * dim
    for vec, weight in zip(vectors, weights):
        for i in range(dim):
            result[i] += vec[i] * weight
    return [x / total_weight for x in result]


def len_safe_get_embedding(
    text: str,
    model: str = EMBEDDING_MODEL,
    max_tokens: int = EMBEDDING_CTX_LENGTH,
    encoding_name: str = EMBEDDING_ENCODING,
) -> list[float]:
    """Get an embedding for long text by chunking, weighting by length, and normalizing.

    Handles text that exceeds the maximum token length by splitting it into
    chunks, creating embeddings for each chunk, computing a weighted average
    based on chunk lengths, and normalizing the result.

    Args:
        text: Text string to embed.
        model: OpenAI embedding model to use. Defaults to EMBEDDING_MODEL.
        max_tokens: Maximum number of tokens per chunk. Defaults to EMBEDDING_CTX_LENGTH.
        encoding_name: Name of the tiktoken encoding to use. Defaults to EMBEDDING_ENCODING.

    Returns:
        Normalized embedding vector, or empty list if text is empty.
    """
    if not text:
        return []

    chunk_embeddings: list[list[float]] = []
    chunk_lens: list[int] = []

    for chunk in chunked_tokens(text, encoding_name=encoding_name, chunk_length=max_tokens):
        chunk_embeddings.append(get_embedding(chunk, model=model))
        chunk_lens.append(len(chunk))

    averaged = weighted_average(chunk_embeddings, chunk_lens)
    normalized = normalize(averaged)
    return normalized


def _window_tokens(
    tokens: list[int],
    chunk_tokens: int,
    overlap_tokens: int,
) -> list[list[int]]:
    """Split a token list into overlapping windows.

    Each window holds ``chunk_tokens`` tokens; consecutive windows overlap by
    ``overlap_tokens`` (so a fact straddling a boundary lands whole in one
    window). The final window always reaches the last token.

    Args:
        tokens: Token ID list to partition.
        chunk_tokens: Maximum number of tokens per window.
        overlap_tokens: Number of tokens shared between consecutive windows.

    Returns:
        List of token-ID sublists.
    """
    if overlap_tokens >= chunk_tokens:
        raise ValueError(
            f"overlap_tokens ({overlap_tokens}) must be less than chunk_tokens ({chunk_tokens})"
        )
    if not tokens:
        return []
    if len(tokens) <= chunk_tokens:
        return [tokens]
    step = chunk_tokens - overlap_tokens
    windows: list[list[int]] = []
    for start in range(0, len(tokens), step):
        windows.append(tokens[start:start + chunk_tokens])
        if start + chunk_tokens >= len(tokens):
            break
    return windows


def chunk_text(
    text: str,
    *,
    chunk_tokens: int = NOTE_CHUNK_TOKENS,
    overlap_tokens: int = NOTE_CHUNK_OVERLAP,
    encoding_name: str = EMBEDDING_ENCODING,
) -> list[str]:
    """Split text into overlapping ~``chunk_tokens``-token passages.

    Returns an empty list for empty text and a single chunk (the original text)
    when it fits in one window.
    """
    if not text:
        return []
    encoding = tiktoken.get_encoding(encoding_name)
    tokens = encoding.encode(text)
    windows = _window_tokens(tokens, chunk_tokens, overlap_tokens)
    # Single-window: return original text to avoid a decode round-trip.
    if windows == [tokens]:
        return [text]
    return [encoding.decode(w) for w in windows]


def build_note_chunks(
    text: str,
    *,
    model: str = EMBEDDING_MODEL,
    chunk_tokens: int = NOTE_CHUNK_TOKENS,
    overlap_tokens: int = NOTE_CHUNK_OVERLAP,
) -> list[dict[str, Any]]:
    """Build the nested ``chunks`` array for a note: one {text, vector} per chunk."""
    return [
        {"text": chunk, "vector": get_embedding(chunk, model=model)}
        for chunk in chunk_text(text, chunk_tokens=chunk_tokens, overlap_tokens=overlap_tokens)
    ]
