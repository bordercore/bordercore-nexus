import uuid

import pytest

from search.helpers import get_creators, get_link, sort_results

pytestmark = [pytest.mark.django_db]


def test_get_creators_with_author():
    result = get_creators({"metadata": {"author": ["J.R.R. Tolkien"]}})
    assert result == "J.R.R. Tolkien"


def test_get_creators_with_multiple():
    result = get_creators({
        "metadata": {
            "author": ["Author A"],
            "artist": ["Artist B"],
        }
    })
    assert "Author A" in result
    assert "Artist B" in result


def test_get_creators_no_metadata():
    assert get_creators({}) == ""


def test_get_creators_no_matching_fields():
    assert get_creators({"metadata": {"editor": ["Someone"]}}) == ""


def test_get_link_bookmark():
    assert get_link("bookmark", {"url": "https://example.com"}) == "https://example.com"


def test_get_link_song_with_album():
    album_uuid = str(uuid.uuid4())
    link = get_link("song", {"album_uuid": album_uuid, "uuid": str(uuid.uuid4())})
    assert album_uuid in link
    assert "/music/album/" in link


def test_get_link_song_without_album():
    artist_uuid = str(uuid.uuid4())
    link = get_link("song", {"artist_uuid": artist_uuid, "uuid": str(uuid.uuid4())})
    assert artist_uuid in link
    assert "/music/artist/" in link


def test_get_link_album():
    test_uuid = str(uuid.uuid4())
    link = get_link("album", {"uuid": test_uuid})
    assert test_uuid in link


def test_get_link_artist():
    artist_uuid = str(uuid.uuid4())
    link = get_link("artist", {"artist_uuid": artist_uuid})
    assert artist_uuid in link


def test_get_link_blob():
    test_uuid = str(uuid.uuid4())
    link = get_link("blob", {"uuid": test_uuid})
    assert test_uuid in link


def test_get_link_note():
    test_uuid = str(uuid.uuid4())
    link = get_link("note", {"uuid": test_uuid})
    assert test_uuid in link


def test_get_link_drill():
    test_uuid = str(uuid.uuid4())
    link = get_link("drill", {"uuid": test_uuid})
    assert test_uuid in link


def test_get_link_todo():
    test_uuid = str(uuid.uuid4())
    link = get_link("todo", {"uuid": test_uuid})
    assert test_uuid in link


def test_get_link_collection():
    test_uuid = str(uuid.uuid4())
    link = get_link("collection", {"uuid": test_uuid})
    assert test_uuid in link


def test_get_link_unknown():
    assert get_link("unknown_type", {"uuid": str(uuid.uuid4())}) == ""


def test_sort_results_unknown_doctype_does_not_raise():
    """A doctype not in the hard-coded category list degrades gracefully.

    Previously an unrecognized doctype (e.g. a newly indexed object type)
    raised KeyError and 500-ed the autocomplete endpoint.
    """
    result = sort_results([{"doctype": "Webmention", "name": "Some Result"}])

    # The unknown-type match survives (grouped after the known types) rather
    # than raising.
    assert any(r.get("doctype") == "Webmention" for r in result)


def test_sort_results_orders_known_types():
    """Known doctypes are emitted in the fixed importance order with splitters."""
    matches = [
        {"doctype": "Collection", "name": "C"},
        {"doctype": "Tag", "name": "T"},
    ]
    result = sort_results(matches)

    splitters = [r["id"] for r in result if r.get("splitter")]
    # Tag is ordered before Collection.
    assert splitters.index("__Tag") < splitters.index("__Collection")
