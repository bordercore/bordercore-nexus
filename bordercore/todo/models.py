"""
This module defines the Todo model and related utilities.

The `Todo` model represents a user‐defined task or action item, complete with
a title, optional notes and URL, JSON data, due date, and priority level.
It includes methods for tag management, priority mapping, and Elasticsearch
indexing, as well as a signal handler for keeping `TagTodo` relations in sync
when a todo’s tags change.
"""

import logging
import uuid
from typing import Any, Dict, List, Optional, Type, Union

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models, transaction
from django.db.models import Count, JSONField, Max
from django.db.models.signals import m2m_changed

from lib.mixins import TimeStampedModel
from search.services import delete_document, index_document
from tag.models import Tag, TagTodo

from .managers import TodoManager

log = logging.getLogger(f"bordercore.{__name__}")


class Todo(TimeStampedModel):
    """A todo is a user-defined task or action item that can be organized and tracked.

    A todo has a name, optional notes and related URL, and can be assigned one or
    more tags. It may include arbitrary JSON data, an optional due date, and a
    priority level (High, Medium, or Low). Todos can be indexed for full‐text search.
    """
    uuid: models.UUIDField = models.UUIDField(default=uuid.uuid4, editable=False)
    name = models.TextField()
    note = models.TextField(null=True, blank=True)
    url = models.URLField(max_length=1000, null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    tags = models.ManyToManyField(Tag)
    data = JSONField(null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)

    objects = TodoManager()

    PRIORITY_CHOICES = [
        (1, "High"),
        (2, "Medium"),
        (3, "Low"),
    ]
    priority: models.IntegerField = models.IntegerField(
        choices=PRIORITY_CHOICES,
        default=3
    )

    def get_tags(self) -> str:
        """Return a comma-separated, alphabetically ordered list of tag names.

        Returns:
            str: Comma-separated tag names in alphabetical order.
        """
        return ", ".join([tag.name for tag in self.tags.all().order_by("name")])

    @staticmethod
    def get_priority_name(priority_value: int) -> Optional[str]:
        """Map an integer priority value to its display name.

        Args:
            priority_value: One of the integers from PRIORITY_CHOICES.

        Returns:
            Corresponding name, or None if not found.
        """
        for priority in Todo.PRIORITY_CHOICES:
            if priority[0] == priority_value:
                return priority[1]
        return None

    @staticmethod
    def get_priority_value(priority_name: str) -> Optional[int]:
        """Map a priority name back to its integer value.

        Args:
            priority_name: One of the names from PRIORITY_CHOICES.

        Returns:
            Corresponding integer, or None if not found.
        """
        for priority in Todo.PRIORITY_CHOICES:
            if priority[1] == priority_name:
                return priority[0]
        return None

    @staticmethod
    def get_todo_counts(user: User) -> List[Dict[str, Union[str, int]]]:
        """Count todos per tag for the given user, sorted by most recent.

        Args:
            user: User instance to filter todos.

        Returns:
            List of dicts with keys 'name' (tag) and 'count' (number of todos).
        """
        # Get the list of tags, initially sorted by count per tag
        tags = Tag.objects.values("id", "name") \
                          .annotate(count=Count("todo", distinct=True)) \
                          .annotate(created=Max("todo__created")) \
                          .filter(user=user, todo__user=user) \
                          .order_by("-created")

        # Convert from queryset to list of dicts so we can further sort them
        counts = [{"name": x["name"], "count": x["count"]} for x in tags]

        return counts

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Save the todo and optionally re-index in Elasticsearch.

        Args:
            *args: Variable length argument list.
            **kwargs: May include 'index_es' to skip indexing (default True).
        """
        # Remove any custom parameters before calling the parent class
        index_es = kwargs.pop("index_es", True)

        super().save(*args, **kwargs)

        # Index the todo item in Elasticsearch
        if index_es:
            self.index_todo()

    def delete(
            self,
            using: Any | None = None,
            keep_parents: bool = False,
    ) -> tuple[int, dict[str, int]]:
        """Delete the todo and remove it from Elasticsearch."""
        todo_uuid = str(self.uuid)
        result = super().delete(using=using, keep_parents=keep_parents)

        def cleanup() -> None:
            try:
                delete_document(todo_uuid)
            except Exception as e:
                log.error("Failed to delete todo %s from Elasticsearch: %s", todo_uuid, e)

        transaction.on_commit(cleanup)
        return result

    def index_todo(self) -> None:
        """Index this todo item in Elasticsearch."""
        index_document(self.elasticsearch_document)

    @property
    def elasticsearch_document(self) -> Dict[str, Any]:
        """Build the dict representation for Elasticsearch indexing.

        Returns:
            Dictionary containing the todo data formatted for Elasticsearch indexing.
        """
        tags = list(self.tags.values_list('name', flat=True))

        return {
            "_index": settings.ELASTICSEARCH_INDEX,
            "_id": self.uuid,
            "_source": {
                "bordercore_id": self.id,
                "uuid": self.uuid,
                "name": self.name,
                "tags": tags,
                "url": self.url,
                "note": self.note,
                "last_modified": self.modified,
                "priority": self.priority,
                "doctype": "todo",
                "date": {"gte": self.created.strftime("%Y-%m-%d %H:%M:%S"), "lte": self.created.strftime("%Y-%m-%d %H:%M:%S")},
                "date_unixtime": self.created.strftime("%s"),
                "user_id": self.user_id,
                **settings.ELASTICSEARCH_EXTRA_FIELDS
            }
        }


def tags_changed(sender: Type[Todo], **kwargs: Any) -> None:
    """Handle m2m 'tags' changes by adding/removing TagTodo relations.

    Triggered on post_add and post_remove of Todo.tags.

    Args:
        sender: The model class sending the signal.
        **kwargs: Contains 'action', 'instance', and 'pk_set'.
    """
    if kwargs["action"] == "post_add":
        todo = kwargs["instance"]

        for tag_id in kwargs["pk_set"]:
            so = TagTodo(tag=Tag.objects.get(user=todo.user, pk=tag_id), todo=todo)
            so.save()

    elif kwargs["action"] == "post_remove":
        todo = kwargs["instance"]

        for tag_id in kwargs["pk_set"]:
            so = TagTodo.objects.get(tag__id=tag_id, todo=todo)
            so.delete()


m2m_changed.connect(tags_changed, sender=Todo.tags.through)
