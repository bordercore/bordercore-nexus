import pytest

from lib.embeddings import batched, build_blob_embedding_text


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
