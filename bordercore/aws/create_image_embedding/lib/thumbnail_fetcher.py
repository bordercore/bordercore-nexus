"""Fetch the image bytes to embed for an image blob from S3.

Prefers the 640px cover thumbnail (``blobs/<uuid>/cover.jpg``) because it is
small and fast to encode. That thumbnail is produced asynchronously by the
separate create_thumbnail Lambda, so for a freshly-uploaded blob it may not
exist yet when this Lambda runs — a race with indexing. In that case we fall
back to the original uploaded file, which is always present in S3 before
indexing runs. This makes the embedding independent of thumbnail timing.
"""
import boto3
from botocore.exceptions import ClientError

_COVER_KEY = "blobs/{uuid}/cover.jpg"
_PREFIX = "blobs/{uuid}/"

# S3 returns NoSuchKey/404 for an absent object when the caller can list the
# bucket; without s3:ListBucket it masks the same condition as AccessDenied/403.
# Treat all of these as "cover thumbnail not ready" and fall back to the original.
_COVER_MISSING_CODES = {"NoSuchKey", "404", "AccessDenied", "403"}


def fetch_image_bytes(uuid: str, bucket: str) -> bytes:
    """Return image bytes to embed for a blob, preferring its cover thumbnail.

    Args:
        uuid: The blob's UUID string, used to build the S3 keys.
        bucket: Name of the S3 bucket to fetch from.

    Returns:
        Raw image bytes — the cover thumbnail if present, otherwise the
        original uploaded file.

    Raises:
        botocore.exceptions.ClientError: If the cover fetch fails for a reason
            other than the object being absent.
        FileNotFoundError: If neither a cover thumbnail nor an original image
            can be found for the blob.
    """
    s3 = boto3.client("s3")
    try:
        response = s3.get_object(Bucket=bucket, Key=_COVER_KEY.format(uuid=uuid))
        return response["Body"].read()
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code not in _COVER_MISSING_CODES:
            raise

    # Cover thumbnail not ready (or never generated) — fall back to the original.
    return _fetch_original(s3, bucket, uuid)


def _fetch_original(s3, bucket: str, uuid: str) -> bytes:
    """Fetch the original uploaded image for a blob from its S3 prefix.

    Lists ``blobs/<uuid>/`` and returns the first object that is the original
    upload (i.e. not a generated ``cover*`` image and not a nested key).

    Args:
        s3: A boto3 S3 client.
        bucket: Name of the S3 bucket.
        uuid: The blob's UUID string.

    Returns:
        Raw bytes of the original uploaded image.

    Raises:
        FileNotFoundError: If no original image is found under the prefix.
    """
    prefix = _PREFIX.format(uuid=uuid)
    response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
    for obj in response.get("Contents", []):
        key = obj["Key"]
        filename = key[len(prefix):]
        # Skip generated covers (cover.jpg, cover-large.jpg) and nested keys.
        if not filename or "/" in filename or filename.startswith("cover"):
            continue
        return s3.get_object(Bucket=bucket, Key=key)["Body"].read()

    raise FileNotFoundError(
        f"No cover thumbnail or original image found under {prefix}"
    )
