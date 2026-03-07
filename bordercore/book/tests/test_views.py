import json

import pytest
from django.test import RequestFactory

from book.tests.factories import AuthorFactory, BookFactory
from book.views import BookListView

pytestmark = [pytest.mark.django_db]


def _setup_view(user, letter="A"):
    """Set up BookListView with a request, bypassing URL routing."""
    factory = RequestFactory()
    request = factory.get(f"/books/{letter}")
    request.user = user
    view = BookListView()
    view.setup(request, letter)
    view.args = (letter,)
    view.kwargs = {}
    view.object_list = view.get_queryset()
    return view


def test_get_queryset_filters_by_letter(authenticated_client):
    user, _ = authenticated_client()

    author = AuthorFactory()
    BookFactory(title="Algorithms", user=user, author=[author])
    BookFactory(title="Brave New World", user=user, author=[author])

    view = _setup_view(user, "A")
    qs = view.get_queryset()
    titles = [b.title for b in qs]
    assert "Algorithms" in titles
    assert "Brave New World" not in titles


def test_get_queryset_filters_by_user(authenticated_client):
    user, _ = authenticated_client()
    from accounts.tests.factories import UserFactory
    other_user = UserFactory()

    author = AuthorFactory()
    BookFactory(title="My Book", user=user, author=[author])
    BookFactory(title="Their Book", user=other_user, author=[author])

    view = _setup_view(user, "M")
    qs = view.get_queryset()
    assert qs.count() == 1
    assert qs.first().title == "My Book"


def test_get_context_data_has_alphabet(authenticated_client):
    user, _ = authenticated_client()

    view = _setup_view(user, "A")
    context = view.get_context_data()
    assert len(context["alphabet"]) == 26
    assert context["selected_letter"] == "A"
    assert context["cols"] == ["title", "author", "year"]


def test_get_context_data_serializes_books(authenticated_client):
    user, _ = authenticated_client()

    author = AuthorFactory(name="Tolkien")
    BookFactory(title="The Hobbit", year=1937, user=user, author=[author])

    view = _setup_view(user, "T")
    context = view.get_context_data()
    info = json.loads(context["info"])
    assert len(info) == 1
    assert info[0]["title"] == "The Hobbit"
    assert info[0]["author"] == "Tolkien"
    assert info[0]["year"] == 1937


def test_get_context_data_multiple_authors(authenticated_client):
    user, _ = authenticated_client()

    a1 = AuthorFactory(name="Author A")
    a2 = AuthorFactory(name="Author B")
    BookFactory(title="Collab Book", user=user, author=[a1, a2])

    view = _setup_view(user, "C")
    context = view.get_context_data()
    info = json.loads(context["info"])
    assert "Author A" in info[0]["author"]
    assert "Author B" in info[0]["author"]


def _setup_view_no_args(user):
    """Set up BookListView with no positional args (no letter in URL)."""
    factory = RequestFactory()
    request = factory.get("/books/")
    request.user = user
    view = BookListView()
    view.setup(request)
    view.args = ()
    view.kwargs = {}
    view.object_list = view.get_queryset()
    return view


def test_get_queryset_defaults_to_a_without_args(authenticated_client):
    """Test that missing URL arg defaults to letter 'A'."""
    user, _ = authenticated_client()

    author = AuthorFactory()
    BookFactory(title="Algorithms", user=user, author=[author])
    BookFactory(title="Brave New World", user=user, author=[author])

    view = _setup_view_no_args(user)
    qs = view.get_queryset()
    titles = [b.title for b in qs]
    assert "Algorithms" in titles
    assert "Brave New World" not in titles


def test_get_queryset_case_insensitive(authenticated_client):
    """Test that letter filtering is case-insensitive."""
    user, _ = authenticated_client()

    author = AuthorFactory()
    BookFactory(title="algorithms", user=user, author=[author])

    view = _setup_view(user, "A")
    qs = view.get_queryset()
    assert qs.count() == 1


def test_author_str():
    """Test Author __str__ returns name."""
    author = AuthorFactory(name="Tolkien")
    assert str(author) == "Tolkien"


def test_book_str(authenticated_client):
    """Test Book __str__ returns title."""
    user, _ = authenticated_client()
    author = AuthorFactory()
    book = BookFactory(title="The Hobbit", user=user, author=[author])
    assert str(book) == "The Hobbit"
