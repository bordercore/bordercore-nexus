import pytest
import tiktoken

from lib.embeddings import (
    EMBEDDING_ENCODING,
    NOTE_CHUNK_OVERLAP,
    NOTE_CHUNK_TOKENS,
    _window_tokens,
    batched,
    build_blob_embedding_text,
    build_note_chunks,
    chunk_text,
)


def test_batched():
    """Test batching an iterable into tuples of specified length."""
    # Normal use case
    result = list(batched("ABCDEFG", 3))
    assert result == [('A', 'B', 'C'), ('D', 'E', 'F'), ('G',)]

    # Edge case: one character string
    result = list(batched("A", 3))
    assert result == [('A',)]

    # Edge case: empty string
    result = list(batched("", 3))
    assert result == []

    # Only one batch
    result = list(batched("ABC", 3))
    assert result == [('A', 'B', 'C')]

    # n larger than the size of the string
    result = list(batched("ABC", 5))
    assert result == [('A', 'B', 'C')]

    # Error case: n is zero
    with pytest.raises(ValueError, match="n must be at least one"):
        list(batched("ABC", 0))

    # Error case: n is negative
    with pytest.raises(ValueError, match="n must be at least one"):
        list(batched("ABC", -1))


def test_build_blob_embedding_text_includes_title_tags_and_body():
    """build_blob_embedding_text prepends title and tags before the body."""
    text = build_blob_embedding_text(
        "Note body here.",
        name="Kitchen Remodel",
        tags=["home", "budget"],
    )

    assert text == (
        "Title: Kitchen Remodel\n\n"
        "Tags: budget, home\n\n"
        "Note body here."
    )


def test_build_blob_embedding_text_omits_empty_fields():
    """build_blob_embedding_text skips blank title, tags, and body sections."""
    assert build_blob_embedding_text("Only body.", name="", tags=[]) == "Only body."
    assert build_blob_embedding_text("", name="Title only", tags=[]) == "Title: Title only"
    assert build_blob_embedding_text("", name="", tags=["solo"]) == "Tags: solo"
    assert build_blob_embedding_text("", name="", tags=[]) == ""


class TestWindowTokens:
    def test_empty(self):
        assert _window_tokens([], 4, 1) == []

    def test_shorter_than_window_is_single(self):
        assert _window_tokens([1, 2, 3], 4, 1) == [[1, 2, 3]]

    def test_windows_overlap_and_cover(self):
        # chunk=4, overlap=1 -> step=3; starts 0,3,6
        out = _window_tokens(list(range(10)), 4, 1)
        assert out == [[0, 1, 2, 3], [3, 4, 5, 6], [6, 7, 8, 9]]
        assert out[0][-1] == out[1][0]
        assert out[-1][-1] == 9

    def test_exact_chunk_boundary(self):
        # len == chunk_tokens hits early return; len == chunk_tokens+1 enters the loop
        assert _window_tokens(list(range(4)), 4, 1) == [list(range(4))]
        out = _window_tokens(list(range(5)), 4, 1)
        assert out == [[0, 1, 2, 3], [3, 4]]
        assert out[-1][-1] == 4

    def test_overlap_not_less_than_chunk_raises(self):
        with pytest.raises(ValueError):
            _window_tokens([1, 2, 3], 4, 4)
        with pytest.raises(ValueError):
            _window_tokens([1, 2, 3], 4, 5)


class TestChunkText:
    def test_empty(self):
        assert chunk_text("") == []

    def test_short_text_single_chunk(self):
        txt = "a short note about cats"
        assert chunk_text(txt, chunk_tokens=100, overlap_tokens=20) == [txt]

    def test_long_text_multiple_chunks_cover_input(self):
        enc = tiktoken.get_encoding(EMBEDDING_ENCODING)
        text = " ".join(f"word{i}" for i in range(400))
        chunks = chunk_text(text, chunk_tokens=100, overlap_tokens=20)
        assert len(chunks) > 1
        assert all(c.strip() for c in chunks)
        assert enc.encode(chunks[-1])[-1] == enc.encode(text)[-1]

    def test_defaults_exist(self):
        assert NOTE_CHUNK_TOKENS == 400
        assert NOTE_CHUNK_OVERLAP == 60

    def test_adjacent_chunks_share_overlap(self):
        enc = tiktoken.get_encoding(EMBEDDING_ENCODING)
        text = " ".join(f"word{i}" for i in range(400))
        chunks = chunk_text(text, chunk_tokens=100, overlap_tokens=20)
        assert len(chunks) >= 2
        assert enc.encode(chunks[0])[-20:] == enc.encode(chunks[1])[:20]


class TestBuildNoteChunks:
    def test_builds_text_and_vector_per_chunk(self, monkeypatch):
        import lib.embeddings as emb

        monkeypatch.setattr(emb, "get_embedding", lambda text, model=None: [0.5, 0.5])
        chunks = build_note_chunks("hello world", chunk_tokens=100, overlap_tokens=20)
        assert chunks == [{"text": "hello world", "vector": [0.5, 0.5]}]

    def test_empty_text_no_chunks(self):
        assert build_note_chunks("") == []
