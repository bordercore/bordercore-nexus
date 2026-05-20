"""Tests for live-sync signal handlers (Channels group_send fan-out).

Named *_live.py to avoid collision with the existing tag-creation signal
handler in todo/models.py, which has its own test coverage.

Note: TodoFactory mutes post_save during creation, so the post_save test
uses Todo.objects.create() directly to allow the signal to fire normally.
"""

from unittest.mock import patch

import pytest

from accounts.tests.factories import UserFactory
from tag.models import TagTodo
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
def test_tags_add_fires_post_only_not_pre():
    """Adding a tag must not fire on pre_add (only on post_*).

    The total notify count for todo.tags.add(tag) is 2: one from our
    m2m_changed handler (post_add) and one from the TagTodo post_save
    triggered by the legacy tags_changed handler in todo/models.py
    which creates a TagTodo as a side effect. Both are post_* signals;
    pre_add is correctly ignored. The client-side 200ms debounce
    collapses the pair into a single refetch.
    """
    user = UserFactory()
    todo = TodoFactory(user=user)
    tag = TagFactory(user=user)
    with patch("todo.signals.async_to_sync") as mock_sync:
        todo.tags.add(tag)
    assert mock_sync.return_value.call_count == 2


@pytest.mark.django_db
def test_tagtodo_reorder_sends_todos_changed():
    """Drag-reorder calls TagTodo.save() on the moved row → post_save fires."""
    user = UserFactory()
    todo_a = TodoFactory(user=user)
    todo_b = TodoFactory(user=user)
    tag = TagFactory(user=user)
    tt_a = TagTodo.objects.create(tag=tag, todo=todo_a, sort_order=1)
    TagTodo.objects.create(tag=tag, todo=todo_b, sort_order=2)
    with patch("todo.signals.async_to_sync") as mock_sync:
        tt_a.reorder(2)
    mock_sync.return_value.assert_called_with(
        f"todos.user.{user.id}",
        {"type": "todos.changed"},
    )


@pytest.mark.django_db
def test_channel_layer_error_does_not_break_save():
    """If Redis is down, the Todo write must still succeed."""
    user = UserFactory()
    with patch("todo.signals.async_to_sync") as mock_sync, \
         patch("todo.signals.logger") as mock_logger:
        mock_sync.side_effect = ConnectionError("redis down")
        # Should NOT raise:
        todo = Todo.objects.create(user=user, name="test todo")
    assert todo.pk is not None
    mock_logger.warning.assert_called_once()
    assert "Failed to send todos.changed" in mock_logger.warning.call_args.args[0]
