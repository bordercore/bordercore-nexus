"""Tests for the prune_feed_items management command."""

from datetime import timedelta

import pytest

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from feed.models import FeedItem, UserFeedItemState
from feed.tests.factories import FeedFactory, FeedItemFactory

pytestmark = [pytest.mark.django_db]


def _fresh_feed():
    """Create a Feed with no items.

    FeedFactory's create_feed_items hook always seeds 3 items regardless of
    arguments, so wipe them to start from a known-empty state.
    """
    feed = FeedFactory()
    FeedItem.objects.filter(feed=feed).delete()
    return feed


def _make_item(feed, *, age_days):
    """Create a FeedItem whose ``created`` is ``age_days`` in the past.

    ``created`` is auto_now_add, so it can only be set after insert via an
    UPDATE that bypasses the auto field.
    """
    item = FeedItemFactory(feed=feed)
    when = timezone.now() - timedelta(days=age_days)
    FeedItem.objects.filter(pk=item.pk).update(created=when)
    item.refresh_from_db()
    return item


def test_prunes_items_older_than_window():
    """Items older than the retention window are deleted; recent ones survive."""
    feed = _fresh_feed()
    old = _make_item(feed, age_days=45)
    recent = _make_item(feed, age_days=5)

    call_command("prune_feed_items", verbosity=0)

    assert not FeedItem.objects.filter(pk=old.pk).exists()
    assert FeedItem.objects.filter(pk=recent.pk).exists()


def test_boundary_item_at_window_edge_is_kept():
    """An item created exactly inside the window (just under N days) is kept."""
    feed = _fresh_feed()
    edge = _make_item(feed, age_days=29)

    call_command("prune_feed_items", days=30, verbosity=0)

    assert FeedItem.objects.filter(pk=edge.pk).exists()


def test_days_argument_overrides_default():
    """A custom --days window changes which items are pruned."""
    feed = _fresh_feed()
    item = _make_item(feed, age_days=20)

    # Default (30 days) keeps a 20-day-old item...
    call_command("prune_feed_items", verbosity=0)
    assert FeedItem.objects.filter(pk=item.pk).exists()

    # ...but a 10-day window prunes it.
    call_command("prune_feed_items", days=10, verbosity=0)
    assert not FeedItem.objects.filter(pk=item.pk).exists()


def test_dry_run_deletes_nothing():
    """--dry-run reports but does not delete."""
    feed = _fresh_feed()
    old = _make_item(feed, age_days=90)

    call_command("prune_feed_items", "--dry-run", verbosity=1)

    assert FeedItem.objects.filter(pk=old.pk).exists()


def test_deletion_cascades_to_user_read_state():
    """Deleting an old item removes its per-user read state via CASCADE."""
    feed = _fresh_feed()
    old = _make_item(feed, age_days=60)
    user = User.objects.create(username="reader")
    state = UserFeedItemState.objects.create(
        user=user, feed_item=old, read_at=timezone.now()
    )

    call_command("prune_feed_items", verbosity=0)

    assert not FeedItem.objects.filter(pk=old.pk).exists()
    assert not UserFeedItemState.objects.filter(pk=state.pk).exists()


def test_batching_deletes_all_eligible_items():
    """A batch size smaller than the eligible set still deletes everything."""
    feed = _fresh_feed()
    for _ in range(5):
        _make_item(feed, age_days=45)

    call_command("prune_feed_items", batch_size=2, verbosity=0)

    assert FeedItem.objects.filter(feed=feed).count() == 0


def test_no_eligible_items_is_a_noop():
    """With nothing old enough, the command runs cleanly and deletes nothing."""
    feed = _fresh_feed()
    recent = _make_item(feed, age_days=1)

    call_command("prune_feed_items", verbosity=1)

    assert FeedItem.objects.filter(pk=recent.pk).exists()


@pytest.mark.parametrize("bad_option", [{"days": 0}, {"days": -5}, {"batch_size": 0}])
def test_invalid_arguments_raise(bad_option):
    """Non-positive --days / --batch-size are rejected."""
    with pytest.raises(CommandError):
        call_command("prune_feed_items", verbosity=0, **bad_option)
