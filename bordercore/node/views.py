"""
Views for node creation, listing, detail display, and management of todos, notes, images, quotes, collections, and nested nodes.

This module defines class-based and function-based views for creating, listing,
and manipulating ``Node`` objects and their related components (todos, notes,
images, quotes, collections, and nested nodes).
"""

from __future__ import annotations

import json
import random
from typing import Any, cast

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db import transaction

from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.utils.html import format_html
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from django.views.generic.detail import DetailView
from django.views.generic.edit import CreateView, FormMixin
from django.views.generic.list import ListView

from blob.models import Blob, RecentlyViewedBlob
from collection.models import Collection
from lib.decorators import validate_post_data
from lib.mixins import FormRequestMixin, UserScopedQuerysetMixin, get_user_object_or_404
from node.forms import NodeForm
from quote.models import Quote
from todo.models import Todo

from .models import Node, NodeTodo, validate_layout
from .services import get_node_list


class NodeListView(LoginRequiredMixin, ListView, FormMixin):
    """List view for a user's nodes.

    Renders a paginated list of ``Node`` objects for the authenticated user and
    provides a bound ``NodeForm`` on the page via ``FormMixin``.
    """

    form_class = NodeForm

    def get_queryset(self) -> Any:
        """Get the queryset of nodes for the current user.

        Returns:
            Queryset of ``Node`` objects filtered by user.
        """
        return get_node_list(self.request.user)

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the node list view.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Dictionary containing context data for the template.
        """
        context = super().get_context_data(**kwargs)
        context["title"] = "Node List"

        # Serialize node list for React (json_script handles JSON encoding)
        context["node_list_data"] = [
            {
                "uuid": str(node.uuid),
                "name": node.name,
                "modified": node.modified.isoformat() if node.modified else "",
                "collection_count": node.collection_count,
                "todo_count": node.todo_count,
                "pinned": node.is_pinned,
            }
            for node in context["object_list"]
        ]

        # Serialize form fields for React (json_script handles JSON encoding)
        form = context["form"]
        context["form_fields_data"] = [
            {
                "name": field.name,
                "label": field.label,
                "type": "textarea" if "Textarea" in str(type(field.field.widget)) else "text",
                "required": field.field.required,
                "maxLength": getattr(field.field, "max_length", None),
            }
            for field in form
        ]

        return context


class NodeDetailView(LoginRequiredMixin, UserScopedQuerysetMixin, DetailView):
    """Detail view for a single node."""

    model = Node
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the node detail view.

        Also populates derived fields on the ``Node`` instance for display.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Dictionary containing context data for the template.
        """
        context = super().get_context_data(**kwargs)
        # json_script handles JSON encoding, so pass Python objects directly
        context["priority_list_data"] = Todo.PRIORITY_CHOICES

        user = cast(User, self.request.user)
        RecentlyViewedBlob.add(user, node=self.object)

        self.object.populate_names()
        self.object.populate_image_info()

        # json_script handles JSON encoding, so pass Python objects directly
        context["layout_data"] = self.object.layout

        return context


class NodeCreateView(LoginRequiredMixin, FormRequestMixin, CreateView):
    """Create new nodes."""

    template_name = "node/node_list.html"
    form_class = NodeForm

    def form_valid(self, form: NodeForm) -> HttpResponse:
        """Process valid form submission for node creation.

        Args:
            form: The validated ``NodeForm``.

        Returns:
            HTTP redirect to the success URL.
        """
        node = form.save(commit=False)
        node.user = cast(User, self.request.user)
        node.save()

        # Save the tags
        form.save_m2m()

        messages.add_message(
            self.request,
            messages.INFO,
            format_html("New node created: <strong>{}</strong>", node.name),
        )

        return HttpResponseRedirect(self.get_success_url())

    def get_success_url(self) -> str:
        """Return the URL to redirect to after successful creation.

        Returns:
            URL string for the node list page.
        """
        return reverse("node:list")


@api_view(["POST"])
def edit_note(request: HttpRequest) -> Response:
    """Edit a node's freeform note.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    node_uuid = request.POST.get("uuid", "").strip()
    note = request.POST.get("note", "").strip()
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        node.note = note
        node.save(update_fields=["note"])

    return Response()


@api_view(["GET"])
def get_todo_list(request: HttpRequest, uuid: str) -> Response:
    """Return the serialized todo list for a node.

    Args:
        request: The HTTP request object.
        uuid: Node UUID.

    Returns:
        Json response with ``todo_list`` payload and status.
    """
    user = cast(User, request.user)
    node = get_user_object_or_404(user, Node, uuid=uuid)
    todo_list = node.get_todo_list()

    response = {"todo_list": todo_list}
    return Response(response)


@api_view(["POST"])
@validate_post_data("node_uuid", "todo_uuid")
def add_todo(request: HttpRequest) -> Response:
    """Attach a ``Todo`` to a node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    todo_uuid = request.POST.get("todo_uuid", "").strip()
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(
            user,
            Node.objects.select_for_update(),
            uuid=node_uuid,
        )
        todo = get_user_object_or_404(user, Todo, uuid=todo_uuid)

        so = NodeTodo(node=node, todo=todo)
        so.save()

        so.node.modified = timezone.now()
        so.node.save()

    return Response(status=status.HTTP_201_CREATED)


@api_view(["POST"])
@validate_post_data("node_uuid", "todo_uuid")
def remove_todo(request: HttpRequest) -> Response:
    """Detach a ``Todo`` from a node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    todo_uuid = request.POST.get("todo_uuid", "").strip()
    user = cast(User, request.user)

    with transaction.atomic():
        so = get_object_or_404(
            NodeTodo.objects.select_related("node"),
            node__user=user,
            node__uuid=node_uuid,
            todo__uuid=todo_uuid,
        )
        node = so.node  # capture before delete
        so.delete()

        node.modified = timezone.now()
        node.save()

    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@validate_post_data("node_uuid", "todo_uuid", "new_position")
def sort_todos(request: HttpRequest) -> Response:
    """Reorder a node's todo item to a new position.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    todo_uuid = request.POST.get("todo_uuid", "").strip()
    try:
        new_position = int(request.POST["new_position"])
    except ValueError:
        return Response(
            {"detail": "new_position must be an integer"},
            status=400,
        )
    user = cast(User, request.user)

    with transaction.atomic():
        so = get_object_or_404(
            NodeTodo,
            node__user=user,
            node__uuid=node_uuid,
            todo__uuid=todo_uuid,
        )
        NodeTodo.reorder(so, new_position)

        so.node.modified = timezone.now()
        so.node.save()

    return Response()


@api_view(["POST"])
@validate_post_data("node_uuid", "layout")
def change_layout(request: HttpRequest) -> Response:
    """Replace a node's layout JSON.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    layout_raw = request.POST.get("layout", "").strip()
    user = cast(User, request.user)

    try:
        layout = json.loads(layout_raw)
    except json.JSONDecodeError:
        return Response(
            {"detail": "Invalid JSON in layout"},
            status=400,
        )

    try:
        validate_layout(layout)
    except ValueError as e:
        return Response(
            {"detail": str(e)},
            status=400,
        )

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        node.layout = layout
        node.save()

    return Response()


@api_view(["POST"])
@validate_post_data("node_uuid")
def add_collection(request: HttpRequest) -> Response:
    """Add a collection component to a node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with new ``collection_uuid``, refreshed ``layout`` and status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    collection_name = request.POST.get("collection_name", "").strip()
    collection_uuid = request.POST.get("collection_uuid", "").strip()
    display = request.POST.get("display", "").strip()
    random_order = request.POST.get("random_order", "").strip() == "true"
    rotate_raw = (request.POST.get("rotate") or "-1").strip()
    try:
        rotate = int(rotate_raw)
    except ValueError:
        return Response(
            {"detail": "Rotate must be an integer"},
            status=400,
        )
    limit_raw = request.POST.get("limit", "").strip().lower()
    if limit_raw in ("", "null"):
        limit = None
    else:
        try:
            limit = int(limit_raw)
        except ValueError:
            return Response(
                {"detail": "Limit must be an integer"},
                status=400,
            )
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        collection = node.add_collection(
            collection_name, collection_uuid, display, rotate, random_order, limit
        )

    response = {
        "collection_uuid": collection.uuid,
        "layout": node.get_layout(),
    }
    return Response(response, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@validate_post_data("node_uuid", "collection_uuid")
def update_collection(request: HttpRequest) -> Response:
    """Edit collection metadata and node options.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    collection_uuid = request.POST.get("collection_uuid", "").strip()
    name = request.POST.get("name", "").strip()
    display = request.POST.get("display", "").strip()
    random_order = request.POST.get("random_order", "").strip() == "true"
    rotate_raw = (request.POST.get("rotate") or "-1").strip()
    try:
        rotate = int(rotate_raw)
    except ValueError:
        return Response(
            {"detail": "Rotate must be an integer"},
            status=400,
        )
    limit_raw = request.POST.get("limit", "").strip().lower()
    if limit_raw in ("", "null"):
        limit = None
    else:
        try:
            limit = int(limit_raw)
        except ValueError:
            return Response(
                {"detail": "Limit must be an integer"},
                status=400,
            )
    user = cast(User, request.user)

    with transaction.atomic():
        collection = get_user_object_or_404(user, Collection, uuid=collection_uuid)
        collection.name = name
        collection.save(update_fields=["name"])

        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        node.update_collection(collection_uuid, display, random_order, rotate, limit)

    return Response()


@api_view(["POST"])
@validate_post_data("node_uuid", "collection_uuid", "collection_type")
def delete_collection(request: HttpRequest) -> Response:
    """Remove a collection component from a node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with refreshed ``layout`` and status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    collection_uuid = request.POST.get("collection_uuid", "").strip()
    collection_type = request.POST.get("collection_type", "").strip()
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        node.delete_collection(collection_uuid, collection_type)

    response = {"layout": node.get_layout()}
    return Response(response)


@api_view(["POST"])
@validate_post_data("node_uuid", "note_name", "color")
def add_note(request: HttpRequest) -> Response:
    """Create a note component and set its color.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with new ``note_uuid``, refreshed ``layout`` and status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    note_name = request.POST.get("note_name", "").strip()
    try:
        color = int(request.POST.get("color", "").strip())
    except ValueError:
        return Response(
            {"detail": "Color must be an integer"},
            status=400,
        )
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        note = node.add_note(note_name)
        node.set_note_color(str(note.uuid), color)

    response = {
        "note_uuid": note.uuid,
        "layout": node.get_layout(),
    }
    return Response(response, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@validate_post_data("node_uuid", "note_uuid")
def delete_note(request: HttpRequest) -> Response:
    """Delete a note component from a node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with refreshed ``layout`` and status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    note_uuid = request.POST.get("note_uuid", "").strip()
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        node.delete_note(note_uuid)

    response = {"layout": node.get_layout()}
    return Response(response)


@api_view(["POST"])
@validate_post_data("node_uuid", "note_uuid", "color")
def set_note_color(request: HttpRequest) -> Response:
    """Set the color index for a note on a node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with operation status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    note_uuid = request.POST.get("note_uuid", "").strip()
    try:
        color = int(request.POST.get("color", "").strip())
    except ValueError:
        return Response(
            {"detail": "Color must be an integer"},
            status=400,
        )
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        node.set_note_color(note_uuid, color)

    return Response()


@api_view(["POST"])
@validate_post_data("node_uuid", "image_uuid")
def add_image(request: HttpRequest) -> Response:
    """Add an image component to a node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with refreshed ``layout`` and status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    image_uuid = request.POST.get("image_uuid", "").strip()
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        image = get_user_object_or_404(user, Blob, uuid=image_uuid)
        node.add_component("image", image)

    node.populate_image_info()

    response = {"layout": node.get_layout()}
    return Response(response, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@validate_post_data("node_uuid")
def add_quote(request: HttpRequest) -> Response:
    """Add a quote component to a node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with refreshed ``layout`` and status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    options = json.loads(request.POST.get("options", "{}").strip())
    user = cast(User, request.user)

    node = get_user_object_or_404(user, Node, uuid=node_uuid)

    # Choose a random quote
    quote = Quote.objects.filter(user=user).order_by("?").first()
    if not quote:
        return Response({"detail": "No quotes available."}, status=404)

    with transaction.atomic():
        node.add_component("quote", quote, options)

    response = {"layout": node.get_layout()}
    return Response(response, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@validate_post_data("node_uuid", "uuid")
def update_quote(request: HttpRequest) -> Response:
    """Edit options for an existing quote component.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with refreshed ``layout`` and status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    uuid = request.POST.get("uuid", "").strip()
    options = json.loads(request.POST.get("options", "").strip())
    options["favorites_only"] = str(options.get("favorites_only", "false")).strip().lower() == "true"
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        node.update_component(uuid, options)

    response = {"layout": node.get_layout()}
    return Response(response)


@api_view(["POST"])
@validate_post_data("node_uuid")
def get_quote(request: HttpRequest) -> Response:
    """Fetch a (possibly favorite-only) random quote and set it on the node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with selected quote payload and status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    favorites_only = request.POST.get("favorites_only", "false").strip()
    user = cast(User, request.user)

    quote_qs = Quote.objects.filter(user=user)
    if favorites_only == "true":
        quote_qs = quote_qs.filter(is_favorite=True)
    quote = quote_qs.order_by("?").first()
    if not quote:
        return Response({"detail": "No quotes available."}, status=404)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        node.set_quote(quote.uuid)

    response = {
        "quote": {
            "uuid": quote.uuid,
            "is_favorite": quote.is_favorite,
            "quote": quote.quote,
            "source": quote.source,
        },
    }
    return Response(response)


@api_view(["POST"])
@validate_post_data("node_uuid")
def add_todo_list(request: HttpRequest) -> Response:
    """Create a todo list component for the node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with refreshed ``layout`` and status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        node.add_todo_list()

    response = {"layout": node.get_layout()}
    return Response(response, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@validate_post_data("node_uuid")
def delete_todo_list(request: HttpRequest) -> Response:
    """Delete the todo list component from the node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with refreshed ``layout`` and status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        node.delete_todo_list()

    response = {"layout": node.get_layout()}
    return Response(response)


@api_view(["POST"])
@validate_post_data("parent_node_uuid", "node_uuid")
def add_node(request: HttpRequest) -> Response:
    """Nest an existing node as a component of another node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with refreshed ``layout`` and status.
    """
    parent_node_uuid = request.POST.get("parent_node_uuid", "").strip()
    node_uuid = request.POST.get("node_uuid", "").strip()
    options = json.loads(request.POST.get("options", "{}").strip())
    user = cast(User, request.user)

    with transaction.atomic():
        parent_node = get_user_object_or_404(user, Node, uuid=parent_node_uuid)
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        parent_node.add_component("node", node, options)

    response = {"layout": parent_node.get_layout()}
    return Response(response, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@validate_post_data("parent_node_uuid", "uuid")
def update_node(request: HttpRequest) -> Response:
    """Edit options for a nested node component.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with refreshed ``layout`` and status.
    """
    parent_node_uuid = request.POST.get("parent_node_uuid", "").strip()
    uuid = request.POST.get("uuid", "").strip()
    options = json.loads(request.POST.get("options", "").strip())
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=parent_node_uuid)
        node.update_component(uuid, options)

    response = {"layout": node.get_layout()}
    return Response(response)


@api_view(["GET"])
def search(request: HttpRequest) -> Response:
    """Search nodes by name.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with a list of objects with ``uuid`` and ``name``.
    """

    query = request.GET.get("query", "").strip()
    user = cast(User, request.user)

    node_list = Node.objects.filter(user=user, name__icontains=query)

    response = [{"uuid": x.uuid, "name": x.name} for x in node_list]
    return Response(response)


@api_view(["GET"])
def node_preview(request: HttpRequest, uuid: str) -> Response:
    """Return a lightweight preview payload for a node.

    Includes image UUIDs, counts, and random selections (when available) for notes and todos.

    Args:
        request: The HTTP request object.
        uuid: Node UUID.

    Returns:
        JSON response with ``info`` block for display and status.
    """
    user = cast(User, request.user)
    node = get_user_object_or_404(user, Node, uuid=uuid)
    preview = node.get_preview()

    try:
        random_note = random.choice(preview["notes"])
    except IndexError:
        random_note = []

    try:
        random_todo = random.choice(preview["todos"])
    except IndexError:
        random_todo = []

    response = {
        "info": {
            "uuid": uuid,
            "name": node.name,
            "images": preview["images"],
            "note_count": len(preview["notes"]),
            "random_note": random_note,
            "random_todo": random_todo,
            "todo_count": len(preview["todos"]),
        },
    }
    return Response(response)


@api_view(["POST"])
@validate_post_data("node_uuid", "uuid")
def remove_component(request: HttpRequest) -> Response:
    """Remove a component (by its component UUID) from a node.

    Args:
        request: The HTTP request object.

    Returns:
        JSON response with refreshed ``layout`` and status.
    """
    node_uuid = request.POST.get("node_uuid", "").strip()
    uuid = request.POST.get("uuid", "").strip()
    user = cast(User, request.user)

    with transaction.atomic():
        node = get_user_object_or_404(user, Node, uuid=node_uuid)
        node.remove_component(uuid)

    response = {"layout": node.get_layout()}
    return Response(response)
