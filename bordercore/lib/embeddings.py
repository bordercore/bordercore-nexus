"""Embedding utilities using the OpenAI Python client."""

import math
import os
from itertools import islice
from typing import Iterable, List, Sequence

import tiktoken
from openai import OpenAI

EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_CTX_LENGTH = 8191
EMBEDDING_ENCODING = "cl100k_base"


def get_embedding(
    text_or_tokens: str | Sequence[int],
    model: str = EMBEDDING_MODEL,
) -> List[float]:
    """Create a single embedding and return its vector."""
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    response = client.embeddings.create(
        input=text_or_tokens,
        model=model,
    )
    # New SDK returns a typed object, not a dict
    return response.data[0].embedding


def batched(iterable: Iterable, n: int):
    """Batch data into tuples of length n. The last batch may be shorter."""
    # batched("ABCDEFG", 3) --> ABC DEF G
    if n < 1:
        raise ValueError("n must be at least one")
    it = iter(iterable)
    while (batch := tuple(islice(it, n))):
        yield batch


def chunked_tokens(text: str, encoding_name: str, chunk_length: int):
    encoding = tiktoken.get_encoding(encoding_name)
    tokens = encoding.encode(text)
    chunks_iterator = batched(tokens, chunk_length)
    yield from chunks_iterator


def normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec))
    return [x / norm for x in vec] if norm > 0 else vec


def weighted_average(vectors: list[list[float]], weights: list[int]) -> list[float]:
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
    """Get an embedding for long text by chunking, weighting by length, and normalizing."""
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
