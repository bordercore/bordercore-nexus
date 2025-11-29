"""Embedding utilities using the OpenAI Python client.

This module provides functions for creating embeddings using OpenAI's API,
including utilities for handling long text by chunking, normalizing vectors,
and computing weighted averages of embeddings.
"""

import math
import os
from collections.abc import Generator, Iterable, Sequence
from itertools import islice

import tiktoken
from openai import OpenAI

EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_CTX_LENGTH = 8191
EMBEDDING_ENCODING = "cl100k_base"


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
