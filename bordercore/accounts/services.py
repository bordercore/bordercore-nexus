"""Service functions for the accounts app's AWS interactions."""

from typing import Any

from django.conf import settings

from lib.aws import s3_delete_object, s3_upload_fileobj


def upload_profile_image(
    profile_uuid: str,
    prefix: str,
    filename: str,
    fileobj: Any,
    content_type: str | None = None,
) -> None:
    """Upload a profile image (background or sidebar) to S3.

    Args:
        profile_uuid: The user profile's UUID string.
        prefix: S3 key prefix (e.g. ``"background"`` or ``"sidebar"``).
        filename: The original filename of the uploaded image.
        fileobj: A file-like object containing the image data.
        content_type: Optional MIME type of the image.
    """
    key = f"{prefix}/{profile_uuid}/{filename}"
    s3_upload_fileobj(
        fileobj,
        settings.AWS_STORAGE_BUCKET_NAME,
        key,
        content_type=content_type,
    )


def delete_profile_image(
    profile_uuid: str,
    prefix: str,
    filename: str,
) -> None:
    """Delete a profile image from S3.

    Args:
        profile_uuid: The user profile's UUID string.
        prefix: S3 key prefix (e.g. ``"background"`` or ``"sidebar"``).
        filename: The filename of the image to delete.
    """
    key = f"{prefix}/{profile_uuid}/{filename}"
    s3_delete_object(settings.AWS_STORAGE_BUCKET_NAME, key)
