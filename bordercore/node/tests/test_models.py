import json

import pytest

from blob.models import Blob
from collection.models import Collection
from node.models import Node
from node.tests.factories import NodeFactory
from quote.tests.factories import QuoteFactory


pytestmark = pytest.mark.django_db


def test_node_add_collection(node):

    collection = node.add_collection()

    # Verify that the collection has been added to the node's layout
    assert str(collection.uuid) in [
        val["uuid"]
        for sublist in node.layout
        for val in sublist
        if "uuid" in val
    ]


def test_node_update_collection(node):

    collection = node.add_collection()
    display = "individual"
    random_order = "false"
    rotate = "rotate"
    limit = 5

    node.update_collection(str(collection.uuid), display, random_order, rotate, limit)

    # Verify that the collection's properties have been updated in the node's layout
    updated_node = Node.objects.get(uuid=node.uuid)

    assert display in [
        val["display"]
        for sublist in updated_node.layout
        for val in sublist
        if "uuid" in val and val["uuid"] == str(collection.uuid)
    ]
    assert rotate in [
        val["rotate"]
        for sublist in updated_node.layout
        for val in sublist
        if "uuid" in val and val["uuid"] == str(collection.uuid)
    ]


def test_node_delete_collection(node):

    collection = node.add_collection()
    node.delete_collection(collection.uuid, "ad-hoc")

    assert Collection.objects.filter(uuid=collection.uuid).first() is None

    # Verify that the collection has been removed from the node's layout
    assert str(collection.uuid) not in [
        val["uuid"]
        for sublist in node.layout
        for val in sublist
        if "uuid" in val
    ]


def test_node_add_note(monkeypatch_blob, node):

    note = node.add_note()

    # Verify that the note has been added to the node's layout
    assert str(note.uuid) in [
        val["uuid"]
        for sublist in node.layout
        for val in sublist
        if "uuid" in val
    ]


def test_node_delete_note(monkeypatch_blob, node):

    note = node.add_note()
    node.delete_note(note.uuid)

    assert Blob.objects.filter(uuid=note.uuid).first() is None

    # Verify that the note has been removed from the node's layout
    assert str(note.uuid) not in [
        val["uuid"]
        for sublist in node.layout
        for val in sublist
        if "uuid" in val
    ]


def test_get_layout(node):

    layout = node.get_layout()

    assert "New Collection" in [
        val["name"]
        for sublist in json.loads(layout)
        for val in sublist
        if val["type"] == "collection"
    ]

    assert True


def test_node_populate_names(node):

    collection_1 = node.add_collection()
    collection_2 = node.add_collection()
    collection_3 = node.add_collection()

    node.populate_names()

    names = [
        val["name"]
        for sublist in node.layout
        for val in sublist
        if "name" in val
    ]

    assert collection_1.name in names
    assert collection_2.name in names
    assert collection_3.name in names


def test_node_set_note_color(monkeypatch_blob, node):

    note = node.add_note()
    color = 1
    node.set_note_color(note.uuid, color)

    assert color in [
        val["color"]
        for sublist in node.layout
        for val in sublist
        if "uuid" in val
        and val["uuid"] == str(note.uuid)
    ]


def test_node_add_image(monkeypatch_blob, node, blob_image_factory):

    new_uuid = node.add_component("image", blob_image_factory[0])

    assert \
        {
            "uuid": new_uuid,
            "image_uuid": str(blob_image_factory[0].uuid),
            "type": "image",
            "options": {}
        } in [
            val
            for sublist in node.layout
            for val in sublist
            if "image_uuid" in val
        ]


def test_node_remove_image(node, blob_image_factory):

    node.add_component("image", blob_image_factory[0])

    node.remove_component(blob_image_factory[0].uuid)

    # Verify that the image has been removed from the node's layout
    assert str(blob_image_factory[0].uuid) not in [
        val["uuid"]
        for sublist in node.layout
        for val in sublist
        if "uuid" in val
    ]


def test_node_add_quote(node, quote):

    new_uuid = node.add_component("quote", quote)

    # Verify that the quote has been added to the node's layout
    assert new_uuid in [
        val["uuid"]
        for sublist in node.layout
        for val in sublist
        if "uuid" in val
    ]


def test_node_update_quote(node, quote):

    new_uuid = node.add_component("quote", quote)
    color = 2
    rotate = 10

    options = {
        "color": color,
        "format": "standard",
        "rotate": rotate,
        "favorites_only": "false"
    }

    node.update_component(new_uuid, options)

    # Verify that the quote's properties have been updated in the node's layout
    assert color in [
        val["options"]["color"]
        for sublist in node.layout
        for val in sublist
        if val["type"] == "quote" and val.get("quote_uuid", None) == str(quote.uuid) and "options" in val
    ]
    assert rotate in [
        val["options"]["rotate"]
        for sublist in node.layout
        for val in sublist
        if val["type"] == "quote" and val.get("quote_uuid", None) == str(quote.uuid) and "options" in val
    ]


def test_node_set_quote(authenticated_client, node):

    user, client = authenticated_client()

    quotes = QuoteFactory.create_batch(2, user=user)

    node.add_component("quote", quotes[0])
    node.set_quote(quotes[1].uuid)

    # Verify that the quote's properties have been updated in the node's layout
    updated_node = Node.objects.get(uuid=node.uuid)

    assert str(quotes[1].uuid) in [
        val["quote_uuid"]
        for sublist in updated_node.layout
        for val in sublist
        if val["type"] == "quote"
    ]


def test_node_add_todo_list(node):

    node.add_todo_list()

    assert \
        {
            "type": "todo"
        } in [
            val
            for sublist in node.layout
            for val in sublist
        ]


def test_node_delete_todo_list(node):

    node.add_todo_list()
    node.delete_todo_list()

    # Verify that the todo list has been removed from the node's layout
    assert "todo" not in [
        val["type"]
        for sublist in node.layout
        for val in sublist
    ]


def test_node_add_node(authenticated_client, node):

    user, client = authenticated_client()

    added_node = NodeFactory.create(user=user)
    node.add_component("node", added_node)

    # Verify that the node has been added to the node's layout
    assert str(added_node.uuid) in [
        val["node_uuid"]
        for sublist in node.layout
        for val in sublist
        if "node_uuid" in val
        and val["node_uuid"] == str(added_node.uuid)
    ]


def test_node_update_node(authenticated_client, node):

    user, client = authenticated_client()

    added_node = NodeFactory.create(user=user)
    uuid = node.add_component("node", added_node)

    color = 2
    rotate = 10

    options = {
        "color": color,
        "format": "standard",
        "rotate": 10,
        "favorites_only": "false"
    }

    node.update_component(uuid, options)

    # Verify that the node's properties have been updated in the node's layout
    updated_node = Node.objects.get(uuid=node.uuid)

    assert color in [
        val["options"]["color"]
        for sublist in updated_node.layout
        for val in sublist
        if val["type"] == "node" and val.get("node_uuid", None) == str(added_node.uuid) and "options" in val
    ]
    assert rotate in [
        val["options"]["rotate"]
        for sublist in updated_node.layout
        for val in sublist
        if val["type"] == "node" and val.get("node_uuid", None) == str(added_node.uuid)
    ]


def test_node_get_preview(authenticated_client, node):

    user, client = authenticated_client()

    added_node = NodeFactory.create(user=user)
    node.add_component("node", added_node)

    preview = node.get_preview()
    assert len(preview["images"]) > 1
    assert len(preview["notes"]) == 0
