"""Smoke tests for the top-level URL wiring in config.urls.

These reverse a representative named route from each included app namespace so
that an include()/namespace regression (or a broken pattern like the historical
book_list one) fails fast rather than only surfacing at request time.
"""
import pytest

from django.urls import resolve, reverse


def test_book_list_reverses_with_letter_arg():
    """book_list reverses for both the base URL and a letter section."""
    # The template renders {% url 'book_list' '' %} for the base URL.
    assert reverse("book_list", args=[""]) == "/books/"
    assert reverse("book_list", args=["B"]) == "/books/B"

    base = resolve("/books/")
    assert base.view_name == "book_list"

    letter = resolve("/books/B")
    assert letter.view_name == "book_list"
    assert letter.args == ("B",)


@pytest.mark.parametrize(
    "name",
    [
        "bookmark:overview",
        "node:list",
        "habit:list",
        "metrics:list",
        "visualize:graph_api",
        "reminder:app",
        "music:playlist_create",
        "search:search",
        "tag:add_alias",
    ],
)
def test_namespaced_routes_reverse(name):
    """A representative named route from each app namespace resolves."""
    url = reverse(name)
    assert url.startswith("/")
