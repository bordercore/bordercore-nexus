from unittest.mock import patch

import pytest

from accounts.services import delete_profile_image, upload_profile_image

pytestmark = [pytest.mark.django_db]


@patch("accounts.services.s3_upload_fileobj")
def test_upload_profile_image(mock_upload):
    upload_profile_image(
        profile_uuid="abc-123",
        prefix="background",
        filename="bg.jpg",
        fileobj=b"fake-image-data",
        content_type="image/jpeg",
    )

    mock_upload.assert_called_once_with(
        b"fake-image-data",
        "bordercore-blobs",
        "background/abc-123/bg.jpg",
        content_type="image/jpeg",
    )


@patch("accounts.services.s3_upload_fileobj")
def test_upload_profile_image_no_content_type(mock_upload):
    upload_profile_image(
        profile_uuid="abc-123",
        prefix="sidebar",
        filename="sidebar.png",
        fileobj=b"data",
    )

    mock_upload.assert_called_once_with(
        b"data",
        "bordercore-blobs",
        "sidebar/abc-123/sidebar.png",
        content_type=None,
    )


@patch("accounts.services.s3_delete_object")
def test_delete_profile_image(mock_delete):
    delete_profile_image(
        profile_uuid="abc-123",
        prefix="background",
        filename="bg.jpg",
    )

    mock_delete.assert_called_once_with(
        "bordercore-blobs",
        "background/abc-123/bg.jpg",
    )
