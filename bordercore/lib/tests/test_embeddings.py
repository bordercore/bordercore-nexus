import pytest

from lib.embeddings import batched


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
