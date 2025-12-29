import argparse
import datetime
import logging
import os
import pickle
import re
from os import makedirs
from pathlib import Path

import boto3

import django
from django.conf import settings

# Suppress boto3/botocore INFO logs (e.g., "Found credentials in environment variables")
logging.getLogger("botocore.credentials").setLevel(logging.WARNING)

bucket_name = settings.AWS_STORAGE_BUCKET_NAME

os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.dev"
django.setup()

from blob.models import ILLEGAL_FILENAMES  # isort:skip

BLOB_DIR = "/home/media"
PICKLE_FILE = "/tmp/uuids_from_filesystem.pkl"
MAX_FILES_TO_DELETE = 5

s3_resource = boto3.resource("s3")
s3_client = boto3.client("s3")


def get_blobs_from_s3():
    s3_uuids = {}

    paginator = s3_resource.meta.client.get_paginator("list_objects_v2")
    page_iterator = paginator.paginate(Bucket=bucket_name)

    for page in page_iterator:
        for key in page["Contents"]:
            m = re.search(r"^blobs/(.*?)/(.+)", str(key["Key"]))
            if m:
                uuid = m.group(1)
                filename = m.group(2)
                if filename not in ILLEGAL_FILENAMES:
                    s3_uuids[uuid] = filename

    return s3_uuids


def get_blobs_from_filesystem():

    filesystem_uuids = {}

    for x in Path(f"{BLOB_DIR}/blobs").rglob("*"):
        if x.is_file() and x.name not in ILLEGAL_FILENAMES:
            uuid = x.parent.name
            filesystem_uuids[uuid] = x.name

    # a_file = open(PICKLE_FILE, "wb")
    # pickle.dump(filesystem_uuids, a_file)
    # a_file.close()

    return filesystem_uuids


def get_filesystems_blobs_from_cache():
    """
    Use a cache while debugging.
    """
    a_file = open(PICKLE_FILE, "rb")
    output = pickle.load(a_file)
    return output


def copy_blob_to_wumpus(uuid, filename):

    makedirs(f"{BLOB_DIR}/blobs/{uuid}", exist_ok=True)

    key = f"blobs/{uuid}/{filename}"
    file_path = f"{BLOB_DIR}/blobs/{uuid}/{filename}"

    s3_client.download_file(bucket_name, key, file_path)

    # Modify the file's mtime to match what's stored in S3 metadata
    obj = s3_resource.Object(bucket_name=bucket_name, key=key)
    try:
        s3_modified = int(obj.metadata.get("file-modified", None))
        atime = os.stat(file_path).st_atime
        mtime = datetime.datetime.fromtimestamp(s3_modified)
        os.utime(file_path, times=(atime, mtime.timestamp()))
    except TypeError:
        print("  Warning: file-modified metadata not found in S3")


def delete_blobs_from_wumpus(uuids):

    for uuid, filename in uuids.items():

        dir = f"{BLOB_DIR}/blobs/{uuid}"
        file_path = Path(f"{dir}/{filename}")
        print(f"Deleting file: {file_path}")
        file_path.unlink()

        # If the directory is now empty, delete it.
        # It won't be empty if the blob was renamed.
        path = Path(dir)
        has_next = next(path.iterdir(), None)
        if has_next is None:
            print(f"Deleting dir: {path}")
            path.rmdir()


if __name__ == "__main__":

    parser = argparse.ArgumentParser(description="")
    parser.add_argument("-n", "--dry-run", help="Dry run. Don't modify anything.", action="store_true")
    args = parser.parse_args()

    dry_run = args.dry_run

    filesystem_uuids = get_blobs_from_filesystem()
    # filesystem_uuids = get_filesystems_blobs_from_cache()

    s3_uuids = get_blobs_from_s3()

    # Find blobs in S3 but not on the filesystem
    for uuid, filename in s3_uuids.items():
        if uuid not in filesystem_uuids or filesystem_uuids[uuid] != filename:
            print(f"File found in S3 but not the filesystem: {uuid}/{filename}")
            if not dry_run:
                copy_blob_to_wumpus(uuid, filename)

    files_to_delete = {}

    # Find blobs on the filesystem but not in S3
    for uuid, filename in filesystem_uuids.items():
        if uuid not in s3_uuids or s3_uuids[uuid] != filename:
            print(f"File found on the filesystem but not in S3: {uuid}/{filename}")
            files_to_delete[uuid] = filename

    # Safe guard against mass deletion
    if len(files_to_delete) > MAX_FILES_TO_DELETE:
        print(f"Error: too many files to delete ({len(files_to_delete)})")
    elif not dry_run:
        delete_blobs_from_wumpus(files_to_delete)
