# pylint: disable=missing-function-docstring,missing-class-docstring,missing-module-docstring

import pytest

import django

from lib.util import (favicon_url, get_missing_blob_ids, get_missing_bookmark_ids,
                      get_pagination_range, is_audio, is_image, is_pdf,
                      is_video, remove_non_ascii_characters, truncate)

django.setup()

from bookmark.models import Bookmark  # isort:skip
from blob.models import Blob  # isort:skip
from lib.util import get_field
from tag.tests.factories import TagFactory
from todo.tests.factories import TodoFactory

pytestmark = pytest.mark.django_db


def test_get_missing_blob_ids(auto_login_user):

    user, _ = auto_login_user()

    found = {
        "hits": {
            "hits": [
                {
                    "_index": "bordercore",
                    "_type": "_doc",
                    "_id": "68568bae-5d53-41e2-ac64-3016e9c96fe1",
                    "_score": 1.0,
                    "_source": {
                    }
                },
                {
                    "_index": "bordercore",
                    "_type": "_doc",
                    "_id": "d77befd1-9172-4872-b527-628217f25d89",
                    "_score": 1.0,
                    "_source": {
                    }
                }
            ]
        }
    }

    expected = [
        Blob.objects.create(
            uuid="68568bae-5d53-41e2-ac64-3016e9c96fe1",
            user=user),
        Blob.objects.create(
            uuid="d77befd1-9172-4872-b527-628217f25d89",
            user=user)
    ]

    assert get_missing_blob_ids(expected, found) == set()

    found = {
        "hits": {
            "hits": [
                {
                    "_index": "bordercore",
                    "_type": "_doc",
                    "_id": "68568bae-5d53-41e2-ac64-3016e9c96fe1",
                    "_score": 1.0,
                    "_source": {
                    }
                },
                {
                    "_index": "bordercore",
                    "_type": "_doc",
                    "_id": "93870195-55a2-426e-970e-d67c63629329",
                    "_score": 1.0,
                    "_source": {
                    }
                }
            ]
        }
    }

    assert get_missing_blob_ids(expected, found) == {"d77befd1-9172-4872-b527-628217f25d89"}


def test_get_missing_bookmark_ids(auto_login_user, monkeypatch):

    user, _ = auto_login_user()

    found = {
        "hits": {
            "hits": [
                {
                    "_index": "bordercore",
                    "_type": "_doc",
                    "_id": "3f40b11c-0b0e-4e11-aeb7-41c2bfee5d91",
                    "_score": 17.678326,
                    "_source": {
                        "uuid": "3f40b11c-0b0e-4e11-aeb7-41c2bfee5d91"
                    }
                },
                {
                    "_index": "bordercore",
                    "_type": "_doc",
                    "_id": "d2edec1c-493a-4d9c-877b-21900e848187bordercore_bookmark_69",
                    "_score": 17.32817,
                    "_source": {
                        "uuid": "d2edec1c-493a-4d9c-877b-21900e848187"
                    }
                }
            ]
        }
    }

    def mock(*args, **kwargs):
        pass

    monkeypatch.setattr(Bookmark, "generate_cover_image", mock)

    expected = [
        Bookmark.objects.create(
            uuid="3f40b11c-0b0e-4e11-aeb7-41c2bfee5d91",
            user=user),
        Bookmark.objects.create(
            uuid="d2edec1c-493a-4d9c-877b-21900e848187",
            user=user)
    ]

    assert get_missing_bookmark_ids(expected, found) == set()

    found = {
        "hits": {
            "hits": [
                {
                    "_index": "bordercore",
                    "_type": "_doc",
                    "_id": "3f40b11c-0b0e-4e11-aeb7-41c2bfee5d91",
                    "_score": 17.678326,
                    "_source": {
                        "uuid": "3f40b11c-0b0e-4e11-aeb7-41c2bfee5d91"
                    }
                },
                {
                    "_index": "bordercore",
                    "_type": "_doc",
                    "_id": "167873d9-28b6-49db-8d9b-d0ed6172f7de",
                    "_score": 17.32817,
                    "_source": {
                        "uuid": "167873d9-28b6-49db-8d9b-d0ed6172f7de"
                    }
                }
            ]
        }
    }

    assert get_missing_bookmark_ids(expected, found) == {"d2edec1c-493a-4d9c-877b-21900e848187"}


def test_truncate():

    string = "foobar"
    assert truncate(string) == "foobar"

    string = "foobar"
    assert truncate(string, 3) == "..."

    # Test edge cases with limit < 3
    assert truncate("foobar", 1) == "f"
    assert truncate("foobar", 2) == "fo"

    # Test that result never exceeds limit
    assert len(truncate("foobar", 1)) == 1
    assert len(truncate("foobar", 2)) == 2
    assert len(truncate("foobar", 3)) == 3
    assert len(truncate("foobar", 4)) == 4
    assert len(truncate("foobar", 5)) == 5

    # Test with empty string
    assert truncate("", 10) == ""

    # Test validation
    with pytest.raises(ValueError, match="limit must be positive"):
        truncate("foobar", -1)
    with pytest.raises(ValueError, match="limit must be positive"):
        truncate("foobar", 0)


def test_remove_non_ascii_characters():

    string = "foobar"
    assert remove_non_ascii_characters(string) == string

    string = "Níl Sén La"
    assert remove_non_ascii_characters(string) == "Nl Sn La"

    string = ""
    assert remove_non_ascii_characters(string) == ""

    # Test with custom default
    assert remove_non_ascii_characters("", default="Custom") == "Custom"
    assert remove_non_ascii_characters("", default="") == ""

    # Test with all non-ASCII characters
    assert remove_non_ascii_characters("日本語") == ""
    assert remove_non_ascii_characters("日本語", default="Unknown") == "Unknown"


def test_util_is_image():

    file = "path/to/file.png"
    assert is_image(file) is True

    file = "path/to/file.gif"
    assert is_image(file) is True

    file = "path/to/file.jpg"
    assert is_image(file) is True

    file = "path/to/file.jpeg"
    assert is_image(file) is True

    file = "file.png"
    assert is_image(file) is True

    file = "path/to/file.pdf"
    assert is_image(file) is False

    # Test edge cases
    assert is_image("") is False
    assert is_image(None) is False
    assert is_image("file") is False  # No extension
    assert is_image("file.") is False  # Empty extension


def test_util_is_pdf():

    file = "path/to/file.pdf"
    assert is_pdf(file) is True

    file = "path/to/file.gif"
    assert is_pdf(file) is False

    # Test edge cases
    assert is_pdf("") is False
    assert is_pdf(None) is False
    assert is_pdf("file") is False  # No extension
    assert is_pdf("file.PDF") is True  # Case insensitive


def test_util_is_video():

    file = "path/to/file.mp4"
    assert is_video(file) is True

    file = "path/to/file.gif"
    assert is_video(file) is False

    # Test edge cases
    assert is_video("") is False
    assert is_video(None) is False
    assert is_video("file") is False  # No extension
    assert is_video("file.MP4") is True  # Case insensitive


def test_util_is_audio():

    file = "path/to/file.mp3"
    assert is_audio(file) is True

    file = "path/to/file.gif"
    assert is_audio(file) is False

    # Test edge cases
    assert is_audio("") is False
    assert is_audio(None) is False
    assert is_audio("file") is False  # No extension
    assert is_audio("file.WAV") is True  # Case insensitive


def test_get_pagination_range():

    x = get_pagination_range(1, 60, 2)
    assert x == [1, 2, 3, 4, 5]

    x = get_pagination_range(5, 60, 2)
    assert x == [3, 4, 5, 6, 7]

    x = get_pagination_range(60, 60, 2)
    assert x == [56, 57, 58, 59, 60]

    x = get_pagination_range(4, 4, 2)
    assert x == [1, 2, 3, 4]

    x = get_pagination_range(1, 4, 2)
    assert x == [1, 2, 3, 4]

    x = get_pagination_range(1, 3, 2)
    assert x == [1, 2, 3]

    x = get_pagination_range(3, 3, 2)
    assert x == [1, 2, 3]

    # Test edge cases
    assert get_pagination_range(1, 0) == []
    assert get_pagination_range(1, -1) == []
    assert get_pagination_range(1, 1) == [1]
    assert get_pagination_range(1, 2) == [1, 2]

    # Test with out-of-range page_number (should clamp)
    assert get_pagination_range(0, 5) == [1, 2, 3, 4, 5]
    assert get_pagination_range(10, 5) == [1, 2, 3, 4, 5]
    assert get_pagination_range(-5, 5) == [1, 2, 3, 4, 5]

    # Test with default paginate_by
    x = get_pagination_range(5, 60)
    assert x == [3, 4, 5, 6, 7]

    # Test with custom paginate_by
    x = get_pagination_range(10, 60, 3)
    assert x == [7, 8, 9, 10, 11, 12, 13]

    # Test validation
    with pytest.raises(ValueError, match="paginate_by must be positive"):
        get_pagination_range(1, 10, 0)
    with pytest.raises(ValueError, match="paginate_by must be positive"):
        get_pagination_range(1, 10, -1)


def test_favicon_url():

    # Test normal multi-component domain
    result = favicon_url("https://www.example.com/page")
    assert "example.com" in result
    assert "favicons/example.com.ico" in result

    # Test single-component domain (bug fix)
    result = favicon_url("http://localhost:8000/page")
    assert "localhost" in result
    assert "favicons/localhost.ico" in result

    result = favicon_url("http://example/page")
    assert "example" in result
    assert "favicons/example.ico" in result

    # Test two-component domain
    result = favicon_url("https://example.com/page")
    assert "example.com" in result
    assert "favicons/example.com.ico" in result

    # Test with subdomain
    result = favicon_url("https://www.bordercore.com/page")
    assert "bordercore.com" in result
    assert "favicons/bordercore.com.ico" in result

    # Test edge cases
    assert favicon_url(None) == ""
    assert favicon_url("") == ""

    # Test with custom size
    result = favicon_url("https://example.com", size=16)
    assert 'width="16"' in result
    assert 'height="16"' in result


def test_get_field(auto_login_user):

    user, _ = auto_login_user()

    tag_1 = TagFactory(name="linux")
    tag_2 = TagFactory(name="django")
    todo = TodoFactory(user=user, name="Bob")
    todo.tags.add(tag_1, tag_2)

    assert get_field(todo, "name") == "Bob"
    assert set(get_field(todo, "tags")) == {"linux", "django"}
    assert get_field(todo, "missing") is None

    data = {"name": "Alice", "value": 10}
    assert get_field(data, "name") == "Alice"
    assert get_field(data, "tags") == []
    assert get_field(data, "missing") is None
