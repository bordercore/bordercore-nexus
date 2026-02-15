import pytest

from node.models import Node
from node.services import delete_note_from_nodes

pytestmark = [pytest.mark.django_db]


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
