import json

import pytest
from faker import Factory as FakerFactory

from django import urls

from blob.models import Blob
from collection.models import Collection
from node.models import Node, NodeTodo
from node.tests.factories import NodeFactory
from todo.tests.factories import TodoFactory

pytestmark = [pytest.mark.django_db]


faker = FakerFactory.create()


def test_node_listview(auto_login_user, node):

    _, client = auto_login_user()

    url = urls.reverse("node:list")
    resp = client.get(url)

    assert resp.status_code == 200


def test_node_detail(auto_login_user, node, blob_image_factory, blob_pdf_factory):

    _, client = auto_login_user()

    url = urls.reverse("node:detail", kwargs={"uuid": node.uuid})
    resp = client.get(url)

    assert resp.status_code == 200


def test_node_create(auto_login_user, node):

    _, client = auto_login_user()

    node_name = faker.text(max_nb_chars=32)

    url = urls.reverse("node:create")
    resp = client.post(url, {
        "name": node_name,
        "note": faker.text(max_nb_chars=100)
    })

    assert resp.status_code == 302
    assert Node.objects.filter(name=node_name).exists()


def test_edit_note(auto_login_user, node):

    _, client = auto_login_user()

    url = urls.reverse("node:edit_note")
    resp = client.post(url, {
        "uuid": node.uuid,
        "note": "Sample Changed Note"
    })

    assert resp.status_code == 200


def test_change_layout(auto_login_user, node):

    _, client = auto_login_user()

    layout = [[{"type": "note"}], [{"type": "bookmark"}], [{"type": "blob"}]]

    url = urls.reverse("node:change_layout")
    resp = client.post(url, {
        "node_uuid": node.uuid,
        "layout": json.dumps(layout)
    })

    assert resp.status_code == 200

    changed_node = Node.objects.get(uuid=node.uuid)
    assert changed_node.layout == layout


def test_add_collection(auto_login_user, node):

    _, client = auto_login_user()

    url = urls.reverse("node:add_collection")
    resp = client.post(url, {
        "node_uuid": node.uuid,
        "collection_name": "Test Collection",
        "display": "list",
        "random_order": "true",
    })

    assert resp.status_code == 200

    resp_json = resp.json()
    updated_node = Node.objects.get(uuid=node.uuid)
    # Verify that the collection has been added to the node's layout
    assert resp_json["collection_uuid"] in [
        val["uuid"]
        for sublist in updated_node.layout
        for val in sublist
        if "uuid" in val
    ]


def test_update_collection(auto_login_user, node, quote):

    user, client = auto_login_user()

    collection = node.add_collection()
    name = faker.text(max_nb_chars=32)
    display = "individual"
    random_order = "true"
    rotate = 30
    limit = 5

    url = urls.reverse("node:update_collection")
    resp = client.post(url, {
        "collection_uuid": collection.uuid,
        "node_uuid": node.uuid,
        "name": name,
        "display": display,
        "random_order": random_order,
        "rotate": rotate,
        "limit": limit,
    })

    assert resp.status_code == 200

    updated_collection = Collection.objects.get(uuid=collection.uuid)
    assert updated_collection.name == name

    # Verify that the collections's properties have been updated in the node's layout
    updated_node = Node.objects.get(uuid=node.uuid)

    assert display in [
        val["display"]
        for sublist in updated_node.layout
        for val in sublist
        if val["type"] == "collection" and val["uuid"] == str(collection.uuid)
    ]
    assert True in [
        val["random_order"]
        for sublist in updated_node.layout
        for val in sublist
        if val["type"] == "collection" and val["uuid"] == str(collection.uuid)
    ]
    assert rotate in [
        val["rotate"]
        for sublist in updated_node.layout
        for val in sublist
        if val["type"] == "collection" and val["uuid"] == str(collection.uuid)
    ]


def test_delete_collection(auto_login_user, node):

    _, client = auto_login_user()

    collection = node.add_collection()

    url = urls.reverse("node:delete_collection")
    resp = client.post(url, {
        "node_uuid": node.uuid,
        "collection_uuid": collection.uuid,
        "collection_type": "ad-hoc",
    })

    assert resp.status_code == 200

    assert Collection.objects.filter(uuid=collection.uuid).first() is None

    # Verify that the collection has been removed from the node's layout
    updated_node = Node.objects.get(uuid=node.uuid)
    assert collection.uuid not in [
        val["uuid"]
        for sublist in updated_node.layout
        for val in sublist
        if "uuid" in val
    ]


def test_add_note(monkeypatch_blob, auto_login_user, node):

    _, client = auto_login_user()

    url = urls.reverse("node:add_note")
    resp = client.post(url, {
        "node_uuid": node.uuid,
        "note_name": faker.text(max_nb_chars=32),
        "color": 1,
    })

    assert resp.status_code == 200

    resp_json = resp.json()
    updated_node = Node.objects.get(uuid=node.uuid)
    # Verify that the note has been added to the node's layout
    assert resp_json["note_uuid"] in [
        val["uuid"]
        for sublist in updated_node.layout
        for val in sublist
        if "uuid" in val
    ]


def test_delete_note(monkeypatch_blob, auto_login_user, node):

    _, client = auto_login_user()

    note = node.add_note()

    url = urls.reverse("node:delete_note")
    resp = client.post(url, {
        "node_uuid": node.uuid,
        "note_uuid": note.uuid
    })

    assert resp.status_code == 200

    assert Blob.objects.filter(uuid=note.uuid).first() is None

    # Verify that the collection has been removed from the node's layout
    updated_node = Node.objects.get(uuid=node.uuid)
    assert str(note.uuid) not in [
        val["uuid"]
        for sublist in updated_node.layout
        for val in sublist
        if "uuid" in val
    ]


def test_node_set_note_color(monkeypatch_blob, auto_login_user, node):

    _, client = auto_login_user()

    note = node.add_note()
    color = 2

    url = urls.reverse("node:set_note_color")
    resp = client.post(url, {
        "node_uuid": node.uuid,
        "note_uuid": note.uuid,
        "color": color
    })

    assert resp.status_code == 200

    # Verify that the note's color has been updated in the node's layout
    updated_node = Node.objects.get(uuid=node.uuid)

    assert color in [
        val["color"]
        for sublist in updated_node.layout
        for val in sublist
        if "uuid" in val
        and val["uuid"] == str(note.uuid)
    ]


def test_node_add_image(monkeypatch_blob, auto_login_user, node, blob_image_factory):

    _, client = auto_login_user()

    url = urls.reverse("node:add_image")
    resp = client.post(url, {
        "node_uuid": node.uuid,
        "image_uuid": blob_image_factory[0].uuid
    })

    assert resp.status_code == 200

    # Verify that the collection has been removed from the node's layout
    updated_node = Node.objects.get(uuid=node.uuid)
    assert str(blob_image_factory[0].uuid) in [
        val["image_uuid"]
        for sublist in updated_node.layout
        for val in sublist
        if "image_uuid" in val
    ]


def test_node_remove_image(monkeypatch_blob, auto_login_user, node, blob_image_factory):

    _, client = auto_login_user()

    new_uuid = node.add_component("image", blob_image_factory[0])

    url = urls.reverse("node:remove_component")
    resp = client.post(url, {
        "node_uuid": node.uuid,
        "uuid": new_uuid
    })

    assert resp.status_code == 200

    # Verify that the image has been removed from the node's layout
    updated_node = Node.objects.get(uuid=node.uuid)
    assert str(blob_image_factory[0].uuid) not in [
        val["image_uuid"]
        for sublist in updated_node.layout
        for val in sublist
        if "image_uuid" in val
    ]


def test_node_add_quote(auto_login_user, node, quote):

    user, client = auto_login_user()

    url = urls.reverse("node:add_quote")
    resp = client.post(url, {
        "node_uuid": node.uuid,
    })

    assert resp.status_code == 200

    updated_node = Node.objects.get(uuid=node.uuid)

    # Verify that the quote has been added to the node's layout
    assert "quote" in [
        val["type"]
        for sublist in updated_node.layout
        for val in sublist
    ]


def test_node_remove_quote(auto_login_user, node, quote):

    user, client = auto_login_user()

    new_uuid = node.add_component("quote", quote)

    url = urls.reverse("node:remove_component")
    resp = client.post(url, {
        "node_uuid": node.uuid,
        "uuid": new_uuid
    })

    assert resp.status_code == 200

    # Verify that the quote has been removed from the node's layout
    updated_node = Node.objects.get(uuid=node.uuid)
    assert "quote" not in [
        val["type"]
        for sublist in updated_node.layout
        for val in sublist
    ]


def test_node_update_quote(auto_login_user, node, quote):

    user, client = auto_login_user()

    node_quote_uuid = node.add_component("quote", quote)
    color = 2
    format = "minimal"
    rotate = 10
    options = {
        "color": color,
        "format": format,
        "rotate": rotate,
        "favorites_only": "false"
    }

    url = urls.reverse("node:update_quote")
    resp = client.post(url, {
        "node_uuid": node.uuid,
        "uuid": node_quote_uuid,
        "options": json.dumps(options)
    })

    assert resp.status_code == 200

    # Verify that the quote's properties have been updated in the node's layout
    updated_node = Node.objects.get(uuid=node.uuid)

    assert color in [
        val["options"]["color"]
        for sublist in updated_node.layout
        for val in sublist
        if val["type"] == "quote"
    ]
    assert format in [
        val["options"]["format"]
        for sublist in updated_node.layout
        for val in sublist
        if val["type"] == "quote"
    ]
    assert rotate in [
        val["options"]["rotate"]
        for sublist in updated_node.layout
        for val in sublist
        if val["type"] == "quote"
    ]


def test_node_get_quote(auto_login_user, node, quote):

    user, client = auto_login_user()

    url = urls.reverse("node:get_quote")
    resp = client.post(url, {
        "node_uuid": node.uuid
    })

    assert resp.status_code == 200

    resp_json = resp.json()
    assert resp_json["quote"]["uuid"] == str(quote.uuid)
    assert resp_json["quote"]["quote"] == quote.quote


def test_node_add_todo_list(auto_login_user, node):

    user, client = auto_login_user()

    url = urls.reverse("node:add_todo_list")
    resp = client.post(url, {
        "node_uuid": node.uuid,
    })

    assert resp.status_code == 200

    updated_node = Node.objects.get(uuid=node.uuid)

    # Verify that the todo list has been added to the node's layout
    assert "todo" in [
        val["type"]
        for sublist in updated_node.layout
        for val in sublist
    ]


def test_node_delete_todo_list(auto_login_user, node):

    user, client = auto_login_user()

    node.add_todo_list()

    url = urls.reverse("node:delete_todo_list")
    resp = client.post(url, {
        "node_uuid": node.uuid,
    })

    assert resp.status_code == 200

    # Verify that the todo list has been removed from the node's layout
    updated_node = Node.objects.get(uuid=node.uuid)
    assert "todo" not in [
        val["type"]
        for sublist in updated_node.layout
        for val in sublist
    ]


def test_node_add_node(auto_login_user, node):

    user, client = auto_login_user()

    added_node = NodeFactory.create(user=user)

    url = urls.reverse("node:add_node")
    resp = client.post(url, {
        "parent_node_uuid": node.uuid,
        "node_uuid": added_node.uuid,
    })

    assert resp.status_code == 200

    updated_node = Node.objects.get(uuid=node.uuid)

    # Verify that the node has been added to the node's layout
    assert "node" in [
        val["type"]
        for sublist in updated_node.layout
        for val in sublist
    ]


def test_node_remove_node(auto_login_user, node):

    user, client = auto_login_user()

    added_node = NodeFactory.create(user=user)
    node.add_component("node", added_node)

    url = urls.reverse("node:remove_component")
    resp = client.post(url, {
        "node_uuid": node.uuid,
        "uuid": added_node.uuid
    })

    assert resp.status_code == 200

    # Verify that the node has been removed from the node's layout
    updated_node = Node.objects.get(uuid=added_node.uuid)
    assert "node" not in [
        val["type"]
        for sublist in updated_node.layout
        for val in sublist
    ]


def test_node_search(auto_login_user, node):

    user, client = auto_login_user()

    url = urls.reverse("node:search")
    resp = client.get(f"{url}?query={node.name}")

    assert resp.status_code == 200

    assert resp.json()[0]["uuid"] == str(node.uuid)
    assert resp.json()[0]["name"] == node.name


def test_get_todo_list(auto_login_user, node):

    user, client = auto_login_user()

    node.add_todo_list()
    todo = TodoFactory(user=user, name="Node todo task")
    url_add = urls.reverse("node:add_todo")
    client.post(url_add, {"node_uuid": node.uuid, "todo_uuid": todo.uuid})

    url = urls.reverse("node:get_todo_list", kwargs={"uuid": node.uuid})
    resp = client.get(url)

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OK"
    assert "todo_list" in data
    assert len(data["todo_list"]) == 1
    assert data["todo_list"][0]["name"] == "Node todo task"
    assert data["todo_list"][0]["uuid"] == str(todo.uuid)


def test_get_todo_list_empty(auto_login_user, node):

    _, client = auto_login_user()

    url = urls.reverse("node:get_todo_list", kwargs={"uuid": node.uuid})
    resp = client.get(url)

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OK"
    assert data["todo_list"] == []


def test_add_todo(auto_login_user, node):

    user, client = auto_login_user()

    node.add_todo_list()
    todo = TodoFactory(user=user, name="Todo to add")

    url = urls.reverse("node:add_todo")
    resp = client.post(url, {"node_uuid": node.uuid, "todo_uuid": todo.uuid})

    assert resp.status_code == 200
    assert resp.json()["status"] == "OK"
    assert NodeTodo.objects.filter(node=node, todo=todo).exists()


def test_remove_todo(auto_login_user, node):

    user, client = auto_login_user()

    node.add_todo_list()
    todo = TodoFactory(user=user, name="Todo to remove")
    NodeTodo.objects.create(node=node, todo=todo)

    url = urls.reverse("node:remove_todo")
    resp = client.post(url, {"node_uuid": node.uuid, "todo_uuid": todo.uuid})

    assert resp.status_code == 200
    assert resp.json()["status"] == "OK"
    assert not NodeTodo.objects.filter(node=node, todo=todo).exists()


def test_sort_todos(auto_login_user, node):

    user, client = auto_login_user()

    node.add_todo_list()
    todo_a = TodoFactory(user=user, name="Todo A")
    todo_b = TodoFactory(user=user, name="Todo B")
    so_a = NodeTodo.objects.create(node=node, todo=todo_a)
    so_b = NodeTodo.objects.create(node=node, todo=todo_b)

    url = urls.reverse("node:sort_todos")
    resp = client.post(url, {
        "node_uuid": node.uuid,
        "todo_uuid": todo_a.uuid,
        "new_position": 2,
    })

    assert resp.status_code == 200
    assert resp.json()["status"] == "OK"

    order = list(
        NodeTodo.objects.filter(node=node).order_by("sort_order").values_list("todo__uuid", flat=True)
    )
    assert order[0] == todo_b.uuid
    assert order[1] == todo_a.uuid


def test_update_node(auto_login_user, node):

    user, client = auto_login_user()

    nested = NodeFactory.create(user=user, name="Nested node")
    component_uuid = node.add_component("node", nested, {"display": "minimal"})

    options = {"display": "full", "rotate": 90}
    url = urls.reverse("node:update_node")
    resp = client.post(url, {
        "parent_node_uuid": node.uuid,
        "uuid": component_uuid,
        "options": json.dumps(options),
    })

    assert resp.status_code == 200
    assert resp.json()["status"] == "OK"

    updated = Node.objects.get(uuid=node.uuid)
    component = next(
        (c for col in updated.layout for c in col if c.get("type") == "node" and c.get("uuid") == component_uuid),
        None,
    )
    assert component is not None
    assert component.get("options", {}).get("display") == "full"
    assert component.get("options", {}).get("rotate") == 90


def test_node_preview(auto_login_user, node):

    user, client = auto_login_user()

    url = urls.reverse("node:preview", kwargs={"uuid": node.uuid})
    resp = client.get(url)

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OK"
    assert "info" in data
    info = data["info"]
    assert info["uuid"] == str(node.uuid)
    assert info["name"] == node.name
    assert "images" in info
    assert "note_count" in info
    assert "random_note" in info
    assert "random_todo" in info
    assert "todo_count" in info
