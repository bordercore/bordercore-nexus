"""Tests for the live-sync signal handler on RecentlyViewedBlob."""

from unittest.mock import patch

import pytest

from accounts.tests.factories import UserFactory
from blob.models import RecentlyViewedBlob
from blob.tests.factories import BlobFactory


@pytest.mark.django_db
def test_recently_viewed_add_sends_changed_to_user_group():
    user = UserFactory()
    blob = BlobFactory(user=user)
    with patch("blob.signals.async_to_sync") as mock_sync:
        RecentlyViewedBlob.add(user, blob=blob)
    mock_sync.assert_called()
    mock_sync.return_value.assert_called_with(
        f"blobs.user.{user.id}",
        {"type": "recently_viewed.changed"},
    )


@pytest.mark.django_db
def test_direct_create_sends_changed_to_user_group():
    """Bare RecentlyViewedBlob.objects.create() also fires the signal."""
    user = UserFactory()
    blob = BlobFactory(user=user)
    with patch("blob.signals.async_to_sync") as mock_sync:
        RecentlyViewedBlob.objects.create(user=user, blob=blob)
    mock_sync.assert_called()
    mock_sync.return_value.assert_called_with(
        f"blobs.user.{user.id}",
        {"type": "recently_viewed.changed"},
    )


@pytest.mark.django_db
def test_channel_layer_error_does_not_break_view_tracking(caplog):
    """If Redis is down, recording a view must still succeed."""
    user = UserFactory()
    blob = BlobFactory(user=user)
    with patch("blob.signals.async_to_sync") as mock_sync:
        mock_sync.side_effect = ConnectionError("redis down")
        # Must not raise:
        RecentlyViewedBlob.add(user, blob=blob)
    assert RecentlyViewedBlob.objects.filter(user=user, blob=blob).exists()
    assert any("Failed to send recently_viewed.changed" in rec.message for rec in caplog.records)
