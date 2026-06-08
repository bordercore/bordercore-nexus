from book.models import Author, Book


def test_author_str():
    """Author __str__ returns the author's name."""
    assert str(Author(name="Tolkien")) == "Tolkien"


def test_book_str():
    """Book __str__ returns the book's title."""
    assert str(Book(title="The Hobbit")) == "The Hobbit"
