import os

# Set this before importing create_thumbnail_lambda, which defines EFS_DIR at top
os.environ["EFS_DIR"] = "/mnt/efs"

import pytest
from bordercore.aws.create_thumbnail.create_thumbnail_lambda import (extract_uuid,
                                                                    get_cover_filename)


def test_extract_uuid():

    assert extract_uuid("blobs/c0739346-dfd0-4f00-af27-5aa10c73c812/foo.jpg") == "c0739346-dfd0-4f00-af27-5aa10c73c812"
    assert extract_uuid("blobs/016b7004-14f8-4fa5-b078-e7dcc9254abb/bar.pdf") == "016b7004-14f8-4fa5-b078-e7dcc9254abb"
    assert extract_uuid("bookmarks/4dc6b272-29a0-432e-a2e9-3c78d37e717a.png") == "4dc6b272-29a0-432e-a2e9-3c78d37e717a"
    with pytest.raises(ValueError):
        assert extract_uuid("bookmarks/cover.png") == "4dc6b272-29a0-432e-a2e9-3c78d37e717a"


def test_get_cover_filename():

    assert get_cover_filename("/mnt/efs/covers/4dc6b272-29a0-432e-a2e9-3c78d37e717f-cover.jpg",
                              "4dc6b272-29a0-432e-a2e9-3c78d37e717f",
                              True
                              ) == "4dc6b272-29a0-432e-a2e9-3c78d37e717f-small.png"

    assert get_cover_filename("/mnt/efs/covers/4dc6b272-29a0-432e-a2e9-3c78d37e717f-cover.jpg",
                              "4dc6b272-29a0-432e-a2e9-3c78d37e717f",
                              False
                              ) == "cover.jpg"

    assert get_cover_filename("/mnt/efs/covers/4dc6b272-29a0-432e-a2e9-3c78d37e717f-cover-large.jpg",
                              "4dc6b272-29a0-432e-a2e9-3c78d37e717f",
                              False
                              ) == "cover-large.jpg"
