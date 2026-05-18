"""Channel-layer fan-out for Todo model changes.

When a Todo for user N is created, updated, or deleted, signal a
todos.changed message to group todos.user.<N>. The TodoConsumer
listening on /ws/todos/ forwards each message as a {"type": "ping"}
to the connected browser, which then re-runs fetchTodos().

Wired up in TodoConfig.ready() (todo/apps.py).
"""

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import m2m_changed, post_delete, post_save
from django.dispatch import receiver

from tag.models import TagTodo
from todo.models import Todo

logger = logging.getLogger(__name__)


def _notify(user_id: int) -> None:
    """Send the todos.changed group message for one user.

    Errors (Redis down, layer misconfigured) are logged and swallowed —
    a Todo write must never fail because the channel layer is unhealthy.
    """
    try:
        layer = get_channel_layer()
        if layer is None:
            return
        async_to_sync(layer.group_send)(
            f"todos.user.{user_id}",
            {"type": "todos.changed"},
        )
    except Exception:
        logger.warning("Failed to send todos.changed for user %s", user_id, exc_info=True)


@receiver(post_save, sender=Todo)
def todo_saved(sender: type[Todo], instance: Todo, **kwargs: Any) -> None:
    _notify(instance.user_id)


@receiver(post_delete, sender=Todo)
def todo_deleted(sender: type[Todo], instance: Todo, **kwargs: Any) -> None:
    _notify(instance.user_id)


@receiver(m2m_changed, sender=Todo.tags.through)
def todo_tags_changed(
    sender: type, instance: Todo, action: str, **kwargs: Any
) -> None:
    """Fan out on tag add/remove/clear. Ignore pre_* and reverse-side actions."""
    if action not in ("post_add", "post_remove", "post_clear"):
        return
    # `instance` is the Todo (forward-side m2m_changed).
    _notify(instance.user_id)


@receiver(post_save, sender=TagTodo)
def tagtodo_saved(sender: type[TagTodo], instance: TagTodo, **kwargs: Any) -> None:
    """Fan out on TagTodo changes — specifically drag-reorder, which
    calls .save() on the moved row. m2m_changed already covers tag
    add/remove, so this only meaningfully fires on sort_order updates.
    """
    _notify(instance.todo.user_id)
