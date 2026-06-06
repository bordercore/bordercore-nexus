import pytest

from node.models import Node
from node.services import delete_note_from_nodes
from node.tests.factories import NodeFactory

pytestmark = [pytest.mark.django_db]


def test_delete_note_from_nodes_handles_null_layout(monkeypatch_blob, node):
    """A node with a NULL layout must not break note deletion for the user."""
    # A second node owned by the same user with no layout at all.
    NodeFactory(user=node.user, layout=None)

    note = node.add_note()

    # Should not raise TypeError on the null-layout node.
    delete_note_from_nodes(note.user, note.uuid)

    updated_node = Node.objects.get(uuid=node.uuid)
    assert str(note.uuid) not in [
        val["uuid"]
        for sublist in updated_node.layout
        for val in sublist
        if "uuid" in val
    ]


def test_delete_note_from_nodes(monkeypatch_blob, node):

    note = node.add_note()
    delete_note_from_nodes(note.user, note.uuid)

    updated_node = Node.objects.get(uuid=node.uuid)

    # Verify that the note has been removed from the node's layout
    assert str(note.uuid) not in [
        val["uuid"]
        for sublist in updated_node.layout
        for val in sublist
        if "uuid" in val
    ]
