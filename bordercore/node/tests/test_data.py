"""
Collection Data Integrity Tests

This module contains tests that ensure all `note` and `collection` UUIDs
referenced within the `layout` field of `Node` objects correspond to actual rows
in their respective database tables (`Blob` for notes, `Collection` for collections).
"""

import django
import pytest

from blob.models import Blob
from collection.models import Collection
from node.models import Node

pytestmark = [pytest.mark.data_quality, pytest.mark.django_db]

django.setup()


def test_node_layout_notes_exist_in_db():
    """Test that all notes in node layouts exist in the database.

    This test validates data consistency between node layout configurations
    and the database by extracting all note UUIDs from node layouts and
    verifying each exists in the Blob model.

    Raises:
        AssertionError: If any note UUIDs found in node layouts are missing from
            the database.
    """
    # Collect all note UUIDs from all node layouts
    note_uuids_to_nodes = {}  # note_uuid -> list of node_uuids that reference it
    all_note_uuids = set()

    nodes = Node.objects.all()

    for node in nodes:
        if not node.layout:
            continue

        # Extract note UUIDs from layout
        for col in node.layout:
            for item in col:
                # Check if item has uuid and is a note
                if ("uuid" in item and item.get("type") == "note"):
                    note_uuid = item["uuid"]
                    all_note_uuids.add(item["uuid"])

                    # Track which nodes reference this note for better error reporting
                    if note_uuid not in note_uuids_to_nodes:
                        note_uuids_to_nodes[note_uuid] = []
                    note_uuids_to_nodes[note_uuid].append(str(node.uuid))

    if not all_note_uuids:
        pytest.fail("Expected non-empty note UUIDs from node layouts; none found.")

    existing_note_uuids = set(
        str(uuid) for uuid in Blob.objects.filter(uuid__in=all_note_uuids)
        .values_list("uuid", flat=True)
    )
    missing_note_uuids = all_note_uuids - existing_note_uuids

    if missing_note_uuids:
        # Create detailed error message showing which nodes reference missing notes
        error_details = []
        for missing_uuid in sorted(missing_note_uuids):
            referencing_nodes = note_uuids_to_nodes[missing_uuid]
            error_details.append(f"note uuid={missing_uuid} (referenced by nodes: {', '.join(referencing_nodes)})")

        error_msg = "Blob notes found in node layouts but not in the database: " + "\n".join(error_details)
        pytest.fail(error_msg)


def test_node_layout_collections_exist_in_db_new() -> None:
    """Verify that all collections referenced in node layouts exist in the database.

    This test validates data consistency between node layout configurations
    and the database by extracting all collection UUIDs from node layouts and
    verifying each exists in the Collection model.

    Raises:
        AssertionError: If any referenced collection UUIDs are missing from
            the `Collection` table.
    """
    # Gather referenced collection UUIDs
    referenced_collection_uuids = {
        str(item["uuid"])
        for layout in Node.objects.values_list("layout", flat=True)
        if layout
        for col in layout
        for item in col
        if item.get("type") == "collection" and item.get("uuid")
    }

    if not referenced_collection_uuids:
        pytest.fail("Expected non-empty collection UUIDs from node layouts; none found.")

    existing_collection_uuids = {
        str(u)
        for u in Collection.objects.filter(uuid__in=referenced_collection_uuids).values_list("uuid", flat=True)
    }

    missing_collection_uuids = referenced_collection_uuids - existing_collection_uuids

    problems = []
    if missing_collection_uuids:
        problems.append(
            ", ".join(sorted(list(missing_collection_uuids))[:20]) + (" …" if len(missing_collection_uuids) > 20 else "")
        )

    assert not problems, "Collections found in node layouts but not in the database: " + "; ".join(problems)
