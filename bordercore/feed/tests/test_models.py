import logging
from pathlib import Path

import pytest
import responses

from django.db import IntegrityError

from feed.models import Feed, FeedItem, UserFeedItemState
from feed.tests.factories import FeedItemFactory

pytestmark = [pytest.mark.django_db]


def test_feed_str(authenticated_client, feed):
    """Test that Feed.__str__ returns the feed name."""
    user, _ = authenticated_client()

    assert str(feed[0]) == "Hacker News"


def test_get_current_feed_id(authenticated_client, feed):
    """Test that get_current_feed_id returns the correct feed for different session states."""
    user, _ = authenticated_client()

    session = {}
    assert Feed.get_current_feed_id(user, session) == feed[2].id

    session = {"current_feed": feed[0].id}
    assert Feed.get_current_feed_id(user, session) == feed[0].id

    # Test for a non-existent current. This should
    #  return the first feed
    # The test emits a warning we'd like to ignore
    logging.disable(logging.WARNING)
    session = {"current_feed": 666}
    assert Feed.get_current_feed_id(user, session) == feed[2].id


def test_get_first_feed(authenticated_client, feed):
    """Test that get_first_feed returns the first feed ordered by sort order."""
    user, _ = authenticated_client()

    assert Feed.get_first_feed(user) == {
        "id": feed[2].id
    }


@responses.activate
def test_update(authenticated_client, feed):
    """Test that update fetches, parses, and upserts feed items correctly.

    The fixture rss.xml has 4 entries; entries 3 and 4 share a link, so the
    upsert collapses them to a single row (the second occurrence wins),
    leaving 3 unique items. The factory-created seed items are wiped first
    via filter().delete() since they have unrelated links.
    """
    user, _ = authenticated_client()

    feed[0].feeditem_set.all().delete()

    with open(Path(__file__).parent / "resources/rss.xml") as f:
        xml = f.read()

    responses.add(responses.GET, feed[0].url, body=xml)

    feed[0].update()

    assert feed[0].last_response_code == 200

    items = FeedItem.objects.filter(feed=feed[0]).order_by("id")

    assert items.count() == 3
    # In-Python dedup in Feed.update() keeps the first occurrence of a
    # given (feed, link) pair; entry 3's "Bad Title" wins over entry 4.
    assert items[2].title == "Bad Title"

    # Entry 1 (the awards thread) has rich HTML content; summary is stripped to text.
    awards_item = items[0]
    assert "Best of 2020" in awards_item.summary
    assert "<a" not in awards_item.summary  # HTML tags stripped
    assert "  " not in awards_item.summary  # whitespace collapsed

    # Entry 2 has a media:thumbnail; entry 1 does not.
    assert items[1].thumbnail_url.startswith("https://b.thumbs.redditmedia.com/")
    assert awards_item.thumbnail_url == ""


@responses.activate
def test_update_preserves_existing_items_and_user_state(authenticated_client, feed):
    """Upsert preserves item identity (and per-user read state) across refreshes."""
    user, _ = authenticated_client()

    feed[0].feeditem_set.all().delete()

    with open(Path(__file__).parent / "resources/rss.xml") as f:
        xml = f.read()

    responses.add(responses.GET, feed[0].url, body=xml)
    responses.add(responses.GET, feed[0].url, body=xml)

    feed[0].update()
    first_pass_ids = list(FeedItem.objects.filter(feed=feed[0]).order_by("id").values_list("id", flat=True))

    # Mark one item as read for the user.
    item = FeedItem.objects.get(pk=first_pass_ids[0])
    UserFeedItemState.objects.create(user=user, feed_item=item)

    # Re-running update should NOT recreate the item; the read state survives.
    feed[0].update()
    second_pass_ids = list(FeedItem.objects.filter(feed=feed[0]).order_by("id").values_list("id", flat=True))

    assert first_pass_ids == second_pass_ids
    assert UserFeedItemState.objects.filter(user=user, feed_item_id=first_pass_ids[0]).exists()


def test_feeditem_unique_together(authenticated_client, feed):
    """A second FeedItem with the same (feed, link) raises IntegrityError."""
    authenticated_client()

    item = feed[0].feeditem_set.first()

    with pytest.raises(IntegrityError):
        FeedItemFactory(feed=feed[0], link=item.link)


def test_user_feed_item_state_unique(authenticated_client, feed):
    """A user can only have one state row per feed item."""
    user, _ = authenticated_client()
    item = feed[0].feeditem_set.first()

    UserFeedItemState.objects.create(user=user, feed_item=item)

    with pytest.raises(IntegrityError):
        UserFeedItemState.objects.create(user=user, feed_item=item)
