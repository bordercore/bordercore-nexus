from unittest.mock import patch

import pytest

from collection.services import (delete_collection_thumbnail,
                                  publish_create_collection_thumbnail)

pytestmark = [pytest.mark.django_db]


@patch("collection.services.s3_delete_object")
def test_delete_collection_thumbnail(mock_delete):
    delete_collection_thumbnail("abc-123")

    mock_delete.assert_called_once_with(
        "bordercore-blobs",
        "collections/abc-123.jpg",
    )


@patch("collection.services.sns_publish")
def test_publish_create_collection_thumbnail(mock_sns):
    publish_create_collection_thumbnail("abc-123")

    mock_sns.assert_called_once()
    call_args = mock_sns.call_args
    message = call_args[0][1]
    assert message["Records"][0]["s3"]["collection_uuid"] == "abc-123"
