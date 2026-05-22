import importlib.util
import json
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

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
    return _load_command_module().Command


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


def test_invoke_embedding_sync_success():
    """Synchronous invoke returns True when Lambda completes without error."""
    module = _load_command_module()
    command = module.Command()
    mock_client = MagicMock()
    mock_client.invoke.return_value = {"StatusCode": 200}

    with patch.object(module, "client", mock_client):
        assert command._invoke_embedding("uuid-here", invoke_async=False) is True
        mock_client.invoke.assert_called_once_with(
            FunctionName="CreateEmbeddings",
            InvocationType="RequestResponse",
            Payload=json.dumps({"uuid": "uuid-here"}),
        )


def test_invoke_embedding_sync_reports_function_error():
    """Synchronous invoke returns False when Lambda returns FunctionError."""
    module = _load_command_module()
    command = module.Command()
    mock_client = MagicMock()
    mock_client.invoke.return_value = {
        "StatusCode": 200,
        "FunctionError": "Unhandled",
        "Payload": BytesIO(b'{"errorMessage": "Elasticsearch store failed"}'),
    }

    with patch.object(module, "client", mock_client):
        assert command._invoke_embedding("uuid-here", invoke_async=False) is False


def test_invoke_embedding_async_accepts_202():
    """Async invoke returns True when Lambda accepts the queued event."""
    module = _load_command_module()
    command = module.Command()
    mock_client = MagicMock()
    mock_client.invoke.return_value = {"StatusCode": 202}

    with patch.object(module, "client", mock_client):
        assert command._invoke_embedding("uuid-here", invoke_async=True) is True
        mock_client.invoke.assert_called_once_with(
            FunctionName="CreateEmbeddings",
            InvocationType="Event",
            Payload=json.dumps({"uuid": "uuid-here"}),
        )


def _load_command_module():
    spec = importlib.util.spec_from_file_location(
        "populate_embeddings_command",
        _COMMAND_PATH,
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
