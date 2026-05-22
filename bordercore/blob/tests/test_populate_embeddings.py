import importlib.util
from pathlib import Path

import pytest

from blob.tests.factories import BlobFactory

pytestmark = [pytest.mark.django_db]

_COMMAND_PATH = (
    Path(__file__).resolve().parents[1]
    / "management"
    / "commands"
    / "populate-embeddings.py"
)


def _load_command_class():
    """Import Command from populate-embeddings.py (hyphenated module name)."""
    spec = importlib.util.spec_from_file_location(
        "populate_embeddings_command",
        _COMMAND_PATH,
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Command


def test_candidate_queryset_notes_only(authenticated_client):
    """--notes-only limits embedding candidates to is_note blobs."""
    user, _ = authenticated_client()
    note = BlobFactory.create(user=user, is_note=True, content="note body")
    BlobFactory.create(user=user, is_note=False, content="doc body")

    queryset = _load_command_class()()._candidate_queryset(notes_only=True)

    assert list(queryset.values_list("uuid", flat=True)) == [note.uuid]


def test_candidate_queryset_excludes_empty_content(authenticated_client):
    """Blobs with empty content are never embedding candidates."""
    user, _ = authenticated_client()
    BlobFactory.create(user=user, is_note=True, content="")

    queryset = _load_command_class()()._candidate_queryset(notes_only=False)

    assert queryset.count() == 0
