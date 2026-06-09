import pytest

from django.db import IntegrityError

from quote.tests.factories import QuoteFactory

pytestmark = [pytest.mark.django_db]


def test_quote_create():
    """Test basic quote creation via factory."""
    quote = QuoteFactory()
    assert quote.pk is not None
    assert quote.quote
    assert quote.source
    assert quote.user is not None


def test_quote_str_truncates():
    """Test __str__ truncates to 100 characters."""
    short = QuoteFactory(quote="Short quote")
    assert str(short) == "Short quote"

    long_text = "x" * 200
    long_quote = QuoteFactory(quote=long_text)
    assert str(long_quote) == "x" * 100


def test_quote_is_favorite_default():
    """Test is_favorite defaults to False."""
    quote = QuoteFactory()
    assert quote.is_favorite is False


def test_quote_is_favorite_true():
    """Test is_favorite can be set to True."""
    quote = QuoteFactory(is_favorite=True)
    assert quote.is_favorite is True


def test_quote_user_protect():
    """Test that deleting a user with quotes raises IntegrityError."""
    quote = QuoteFactory()
    with pytest.raises(IntegrityError):
        quote.user.delete()


def test_quote_uuid_is_unique():
    """The uuid column enforces uniqueness at the database level."""
    q1 = QuoteFactory()
    with pytest.raises(IntegrityError):
        QuoteFactory(uuid=q1.uuid)
