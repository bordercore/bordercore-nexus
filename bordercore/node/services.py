"""
Node services.

Provides helpers for querying a user's nodes and maintaining their layout
structure.
"""
from typing import Any
from uuid import UUID

from django.apps import apps
from django.db import transaction
from django.db.models import Count
from django.db.models.query import QuerySet


def get_node_list(user: Any) -> QuerySet:
    """Return the user's nodes with useful counts.

    Args:
        user: Authenticated user instance used to filter nodes.

    Returns:
        A queryset of nodes, typically annotated with counts (e.g.,
        blob/bookmark/todo counts) and ordered for display.
    """

    Node = apps.get_model("node", "Node")

    nodes = Node.objects.filter(
        user=user
    ).annotate(
        todo_count=Count("todos")
    ).order_by(
        "-modified"
    )

    for node in nodes:
        node.collection_count = len([
            True
            for sublist in node.layout
            for val in sublist
            if "uuid" in val
            and val["type"] == "collection"
        ])

    return nodes


def delete_note_from_nodes(user: Any, note_uuid: UUID | str) -> None:
    """Remove a deleted note from all node layouts for the user.

    This cleans up references to the note's UUID inside each node's
    layout structure.

    Args:
        user: Authenticated user instance used to filter nodes.
        note_uuid: UUID of the note to remove (as a UUID or string).
    """

    Node = apps.get_model("node", "Node")

    with transaction.atomic():
        for node in Node.objects.filter(user=user):
            changed = False
            layout = node.layout
            for i, col in enumerate(layout):
                temp_layout = [x for x in col if "uuid" not in x or x["uuid"] != str(note_uuid)]
                if layout[i] != temp_layout:
                    changed = True
                layout[i] = temp_layout

            if changed:
                node.layout = layout
                node.save()
