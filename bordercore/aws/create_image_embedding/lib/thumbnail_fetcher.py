"""Fetch the cover thumbnail for an image blob from S3."""
import boto3

# For image blobs, aws/create_thumbnail produces a single 640px-max cover
# at blobs/<uuid>/cover.jpg. (PDFs/videos additionally write cover-large.jpg,
# but image search only embeds true image blobs.)
_KEY_TEMPLATE = "blobs/{uuid}/cover.jpg"


def fetch_thumbnail(uuid: str, bucket: str) -> bytes:
    s3 = boto3.client("s3")
    response = s3.get_object(Bucket=bucket, Key=_KEY_TEMPLATE.format(uuid=uuid))
    return response["Body"].read()
