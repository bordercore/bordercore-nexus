"""Tests for live-sync signal handlers (Channels group_send fan-out).

Named *_live.py to avoid collision with the existing tag-creation signal
handler in todo/models.py, which has its own test coverage.

Note: TodoFactory mutes post_save during creation, so the post_save test
uses Todo.objects.create() directly to allow the signal to fire normally.
"""

from unittest.mock import patch

import pytest

from accounts.tests.factories import UserFactory
from tag.tests.factories import TagFactory
from todo.models import Todo
from todo.tests.factories import TodoFactory


@pytest.mark.django_db
def test_post_save_sends_todos_changed_to_user_group():
    user = UserFactory()
    with patch("todo.signals.async_to_sync") as mock_sync:
        Todo.objects.create(name="test task", user=user)
    mock_sync.assert_called()
    layer_send = mock_sync.return_value
    layer_send.assert_called_with(
        f"todos.user.{user.id}",
        {"type": "todos.changed"},
    )


@pytest.mark.django_db
def test_post_delete_sends_todos_changed_to_user_group():
    user = UserFactory()
    todo = TodoFactory(user=user)
    with patch("todo.signals.async_to_sync") as mock_sync:
        todo.delete()
    mock_sync.assert_called()
    layer_send = mock_sync.return_value
    layer_send.assert_called_with(
        f"todos.user.{user.id}",
        {"type": "todos.changed"},
    )


@pytest.mark.django_db
def test_m2m_tag_add_sends_todos_changed():
    user = UserFactory()
    todo = TodoFactory(user=user)
    tag = TagFactory(user=user)
    with patch("todo.signals.async_to_sync") as mock_sync:
        todo.tags.add(tag)
    mock_sync.return_value.assert_called_with(
        f"todos.user.{user.id}",
        {"type": "todos.changed"},
    )


@pytest.mark.django_db
def test_m2m_tag_remove_sends_todos_changed():
    user = UserFactory()
    todo = TodoFactory(user=user)
    tag = TagFactory(user=user)
    todo.tags.add(tag)
    with patch("todo.signals.async_to_sync") as mock_sync:
        todo.tags.remove(tag)
    mock_sync.return_value.assert_called_with(
        f"todos.user.{user.id}",
        {"type": "todos.changed"},
    )


@pytest.mark.django_db
def test_m2m_pre_add_does_not_send():
    """pre_* actions fire too, but we only care about post_*."""
    user = UserFactory()
    todo = TodoFactory(user=user)
    tag = TagFactory(user=user)
    with patch("todo.signals.async_to_sync") as mock_sync:
        todo.tags.add(tag)
    # Exactly one call (the post_add), not two (pre_add + post_add)
    assert mock_sync.return_value.call_count == 1


@pytest.mark.django_db
def test_channel_layer_error_does_not_break_save(caplog):
    """If Redis is down, the Todo write must still succeed."""
    user = UserFactory()
    with patch("todo.signals.async_to_sync") as mock_sync:
        mock_sync.side_effect = ConnectionError("redis down")
        # Should NOT raise:
        todo = Todo.objects.create(user=user, name="test todo")
    assert todo.pk is not None
    assert any("Failed to send todos.changed" in rec.message for rec in caplog.records)
