"""
Models for managing nodes and their associated components.

This module defines the Node and NodeTodo models for organizing collections,
notes, todos, and other components in a flexible layout system.
"""

import json
import random
import uuid
from typing import Any, Dict, List, Union
from uuid import UUID

from django.conf import settings
from django.db import models, transaction
from django.db.models import Count, JSONField
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.urls import reverse
from django.utils import timezone

from blob.models import Blob
from collection.models import Collection
from lib.mixins import SortOrderMixin, TimeStampedModel
from quote.models import Quote
from todo.models import Todo


def default_layout() -> List[List[Dict[str, Any]]]:
    """Return the default layout structure for a new node.

    Django JSONField default must be a callable.

    Returns:
        A 3-column layout with a todo component in the first column.
    """
    return [[{"type": "todo"}], [], []]


class Node(TimeStampedModel):
    """A collection of blobs, bookmarks, and notes around a certain topic.

    Nodes organize various components (collections, notes, todos, images, quotes)
    in a customizable grid layout stored as JSON.
    """
    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    name = models.TextField()
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    note = models.TextField(blank=True, null=True)
    todos: models.ManyToManyField = models.ManyToManyField(Todo, through="NodeTodo")
    layout = JSONField(default=default_layout, null=True, blank=True)

    def __str__(self) -> str:
        """Return string representation of the node."""
        return self.name

    @transaction.atomic
    def add_collection(
        self,
        name: str = "New Collection",
        uuid: str | None = None,
        display: str = "list",
        rotate: int = -1,
        random_order: bool = False,
        limit: int | None = None
    ) -> Collection:
        """Add a collection to the node's layout.

        Args:
            name: Name for new collection (ignored if uuid provided).
            uuid: UUID of existing collection to add.
            display: Display mode for the collection.
            rotate: Rotation setting for collection display.
            random_order: Whether to randomize collection order.
            limit: Maximum number of items to display.

        Returns:
            The collection that was added to the layout.
        """
        if uuid and uuid != "":
            # If a uuid is given, use an existing collection
            collection = Collection.objects.get(uuid=uuid)
            collection_type = "permanent"
        else:
            collection = Collection.objects.create(name=name, user=self.user)
            collection_type = "ad-hoc"

        layout = self.layout or []
        layout[0].insert(0, {
            "type": "collection",
            "uuid": str(collection.uuid),
            "display": display,
            "collection_type": collection_type,
            "rotate": rotate,
            "random_order": random_order,
            "limit": limit,
        })
        self.layout = layout
        self.save()

        return collection

    def update_collection(
        self,
        collection_uuid: str,
        display: str,
        random_order: bool,
        rotate: int,
        limit: int | None
    ) -> None:
        """Edit display settings for a collection in the layout.

        Args:
            collection_uuid: UUID of the collection to edit.
            display: New display mode.
            random_order: Whether to randomize collection order.
            rotate: New rotation setting.
            limit: Maximum number of items to display.
        """
        if self.layout:
            for column in self.layout:
                for row in column:
                    if "uuid" in row and row["uuid"] == collection_uuid:
                        row["display"] = display
                        row["rotate"] = rotate
                        row["random_order"] = random_order
                        row["limit"] = limit

        self.save()

    def delete_collection(self, collection_uuid: str, collection_type: str) -> None:
        """Remove a collection from the layout and optionally delete it.

        Args:
            collection_uuid: UUID of the collection to remove.
            collection_type: Type of collection ("ad-hoc" collections are deleted).
        """
        if collection_type == "ad-hoc":
            collection = Collection.objects.get(uuid=collection_uuid)
            collection.delete()

        layout = self.layout or []
        for i, col in enumerate(layout):
            layout[i] = [
                x
                for x in col
                if "uuid" not in x
                or x["uuid"] != str(collection_uuid)
            ]

        self.layout = layout
        self.save()

    def add_note(self, name: str = "New Note") -> Blob:
        """Add a new note to the node's layout.

        Args:
            name: Name for the new note.

        Returns:
            The newly created note blob.
        """
        note = Blob.objects.create(
            user=self.user,
            date=timezone.now().strftime("%Y-%m-%d"),
            name=name,
            is_note=True
        )
        note.index_blob()

        layout = self.layout or []
        layout[0].insert(
            0,
            {
                "type": "note",
                "uuid": str(note.uuid),
                "color": 1
            }
        )
        self.layout = layout
        self.save()

        return note

    def delete_note(self, note_uuid: str) -> None:
        """Remove a note from the layout and delete it.

        Args:
            note_uuid: UUID of the note to delete.
        """
        note = Blob.objects.get(uuid=note_uuid)
        note.delete()

        layout = self.layout or []
        for i, col in enumerate(layout):
            layout[i] = [x for x in col if "uuid" not in x or x["uuid"] != str(note_uuid)]

        self.layout = layout
        self.save()

    def get_layout(self) -> str:
        """Get the node's layout with populated names as JSON string.

        Returns:
            JSON string representation of the layout with names populated.
        """
        self.populate_names()
        return json.dumps(self.layout)

    def populate_names(self) -> None:
        """Populate collection and note names in the layout.

        Efficiently fetches names for all collections and notes in the layout
        using bulk queries rather than individual lookups.
        """
        if not self.layout:
            return

        # Get a list of all uuids for all collections and notes in this node.
        uuids = [
            val["uuid"]
            for sublist in self.layout
            for val in sublist
            if "uuid" in val
            and val.get("type") in ["collection", "note"]
        ]

        # Populate a lookup dictionary with the collection and note names, uuid => name
        lookup: Dict[str, Dict[str, str | int | None]] = {}

        collections = Collection.objects.filter(uuid__in=uuids).annotate(
            item_count=Count("collectionobject")
        )
        lookup = {str(c.uuid): {"name": c.name, "count": c.item_count} for c in collections}

        for b in Blob.objects.filter(uuid__in=uuids):
            lookup[str(b.uuid)] = {
                "name": b.name
            }

        # Finally, add the collection and note names to the node's layout object
        for column in self.layout:
            for row in column:
                if row.get("type") in ["collection", "note"]:
                    row["name"] = lookup[row["uuid"]]["name"]
                    if "count" in lookup[row["uuid"]]:
                        row["count"] = lookup[row["uuid"]]["count"]

    def populate_image_info(self) -> None:
        """Populate image information for image components in the layout."""
        if not self.layout:
            return

        for column in self.layout:
            for row in column:
                if row.get("type") == "image":
                    blob = Blob.objects.get(uuid=row["image_uuid"])
                    row["image_url"] = blob.get_cover_url()
                    row["image_title"] = blob.name

    def set_note_color(self, note_uuid: str, color: int) -> None:
        """Set the color for a note component in the layout.

        Args:
            note_uuid: UUID of the note to edit.
            color: Color value to set for the note.
        """
        if not self.layout:
            return

        for column in self.layout:
            for row in column:
                if "uuid" in row and row["uuid"] == note_uuid:
                    row["color"] = color

        self.save()

    def set_quote(self, quote_uuid: Union[str, UUID]) -> None:
        """Set the quote UUID for quote components in the layout.

        Args:
            quote_uuid: UUID of the quote to set.
        """
        if not self.layout:
            return

        for column in self.layout:
            for row in column:
                if row.get("type") == "quote":
                    row["quote_uuid"] = str(quote_uuid)

        self.save()

    def add_todo_list(self) -> None:
        """Add a todo list component to the layout."""
        layout = self.layout or []
        layout[0].insert(
            0,
            {
                "type": "todo",
            }
        )
        self.layout = layout
        self.save()

    def delete_todo_list(self) -> None:
        """Remove all todo list components and associated todos from the node."""
        layout = self.layout or []
        for i, col in enumerate(layout):
            layout[i] = [x for x in col if x.get("type") != "todo"]
        self.layout = layout
        self.save()

        for so in NodeTodo.objects.filter(node=self):
            so.todo.delete()

    def get_todo_list(self) -> List[Dict[str, Any]]:
        """Get all todos associated with this node.

        Returns:
            List of dictionaries containing todo information.
        """
        todo_list = self.todos.all().only("name", "note", "priority", "url", "uuid").order_by("nodetodo__sort_order")

        return [
            {
                "name": x.name,
                "note": x.note,
                "priority": x.priority,
                "uuid": x.uuid,
                "url": x.url,
            }
            for x
            in todo_list
        ]

    def get_preview(self) -> Dict[str, Any]:
        """Generate a preview of the node's contents.

        Returns:
            Dictionary containing preview images, notes, and todos.
        """
        images: List[Dict[str, Any]] = []

        if not self.layout:
            return {
                "images": images,
                "notes": [],
                "todos": self.get_todo_list()
            }

        # Get a list of all uuids for all images in this node.
        image_uuids = [
            val["uuid"]
            for sublist in self.layout
            for val in sublist
            if "uuid" in val
            and val.get("type") in ["image"]
        ]
        if image_uuids:
            random_uuid = random.choice(image_uuids)
            blob = Blob.objects.get(uuid=random_uuid)
            images.append({
                "uuid": random_uuid,
                "cover_url": blob.get_cover_url(),
                "blob_url": reverse("blob:detail", kwargs={"uuid": random_uuid})
            })

        # Get a list of all uuids for all collections in this node.
        collection_uuids = [
            val["uuid"]
            for sublist in self.layout
            for val in sublist
            if "uuid" in val
            and val.get("type") in ["collection"]
        ]

        collections = {str(c.uuid): c for c in Collection.objects.filter(uuid__in=collection_uuids)}
        all_objects = []
        for cu in collection_uuids:
            c = collections.get(cu)
            if not c:
                continue
            all_objects.extend(c.get_object_list()["object_list"])

        blobs = [x for x in all_objects if x.get("type") == "blob"]
        blob_count = len([x for x in all_objects if x.get("type") == "blob"])

        # We ultimately want two images. If we already found one image, then
        #  we only need one more from a collection. If not, we need two.
        images.extend([
            {
                "uuid": obj["uuid"],
                "cover_url": obj["cover_url"],
                "blob_url": obj["url"]
            }
            for obj in
            random.sample(blobs, min(2 - len(images), blob_count))
        ])

        notes = [
            val
            for sublist in self.layout
            for val in sublist
            if "uuid" in val
            and val.get("type") in ["note"]
        ]

        todos = self.get_todo_list()

        return {
            "images": images,
            "notes": notes,
            "todos": todos
        }

    def add_component(
        self,
        component_type: str,
        component: Union[Blob, "Node", Quote],
        options: Dict[str, Any] | None = None
    ) -> str:
        """Add an image, quote or node component to the layout.

        Args:
            component_type: Type of component to add.
            component: The component object to add.
            options: Additional options for the component.

        Returns:
            UUID string of the new component.
        """
        options = options or {}

        new_uuid = str(uuid.uuid4())

        layout = self.layout or []
        layout[0].insert(
            0,
            {
                "type": component_type,
                "uuid": new_uuid,
                f"{component_type}_uuid": str(component.uuid),
                "options": options,
            }
        )
        self.layout = layout
        self.save()

        return new_uuid

    def update_component(self, uuid: str, options: Dict[str, Any]) -> None:
        """Edit the options for a quote or node component.

        Args:
            uuid: UUID of the component to edit.
            options: New options dictionary for the component.
        """
        if not self.layout:
            return

        for column in self.layout:
            for row in column:
                if row.get("uuid", None) == uuid:
                    row["options"] = options

        self.save()

    def remove_component(self, uuid: str) -> None:
        """Remove an image, quote, or node component from the layout.

        Args:
            uuid: UUID of the component to remove.
        """
        layout = self.layout or []
        for i, col in enumerate(layout):
            layout[i] = [
                x
                for x in col
                if x.get("uuid", None) != str(uuid)
            ]

        self.layout = layout
        self.save()


class NodeTodo(SortOrderMixin, models.Model):
    """Through model for Node-Todo many-to-many relationship with sort ordering.

    Provides a sorted relationship between nodes and todos, allowing todos
    to be ordered within each node.
    """
    node = models.ForeignKey(Node, on_delete=models.CASCADE)
    todo = models.ForeignKey(Todo, on_delete=models.CASCADE)
    field_name = "node"

    # make the manager visible to mypy
    objects: models.Manager["NodeTodo"] = models.Manager()

    def __str__(self) -> str:
        """Return string representation of the NodeTodo relationship."""
        return f"SortOrder: {self.node}, {self.todo}"

    class Meta:
        ordering = ("sort_order",)
        constraints = [
            models.UniqueConstraint(fields=["node", "todo"], name="uniq_node_todo")
        ]


@receiver(pre_delete, sender=NodeTodo)
def remove_todo(sender: type, instance: NodeTodo, **kwargs: Any) -> None:
    """Handle cleanup when a NodeTodo is deleted.

    Args:
        sender: The model class that sent the signal.
        instance: The NodeTodo instance being deleted.
        **kwargs: Additional keyword arguments from the signal.
    """
    instance.handle_delete()
