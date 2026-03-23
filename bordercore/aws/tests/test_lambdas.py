import os

# Set this before importing create_thumbnail_lambda, which defines EFS_DIR at top
os.environ["EFS_DIR"] = "/mnt/efs"

import pytest
from PIL import Image

from bordercore.aws.create_thumbnail.create_thumbnail_lambda import (extract_uuid,
                                                                    get_cover_filename)
from bordercore.aws.create_thumbnail.lib.thumbnails import (
    create_thumbnail,
    create_thumbnail_from_text,
    render_text_thumbnail,
)
from bordercore.aws.create_thumbnail.lib.util import is_text


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


def test_is_text():
    """Test that is_text correctly identifies text document file extensions."""

    assert is_text("path/to/file.txt") is True
    assert is_text("path/to/file.md") is True
    assert is_text("path/to/file.csv") is True
    assert is_text("file.txt") is True

    assert is_text("path/to/file.pdf") is False
    assert is_text("path/to/file.png") is False
    assert is_text("path/to/file.docx") is False

    assert is_text("") is False
    assert is_text(None) is False
    assert is_text("file") is False
    assert is_text("file.TXT") is True


def test_render_text_thumbnail():
    """Test that render_text_thumbnail produces a 128x128 RGB image."""

    img = render_text_thumbnail("Title", "Body text")
    assert img.size == (128, 128)
    assert img.mode == "RGB"


def test_render_text_thumbnail_empty_inputs():
    """Test rendering with empty title and/or content."""

    img = render_text_thumbnail("", "")
    assert img.size == (128, 128)

    img = render_text_thumbnail("Title Only", "")
    assert img.size == (128, 128)

    img = render_text_thumbnail("", "Content only")
    assert img.size == (128, 128)


def test_render_text_thumbnail_long_content():
    """Test that very long content doesn't cause errors."""

    img = render_text_thumbnail("A" * 200, "word " * 500)
    assert img.size == (128, 128)


def test_create_thumbnail_from_text(tmp_path):
    """Test that create_thumbnail_from_text writes a cover JPEG."""

    text_file = tmp_path / "notes.txt"
    text_file.write_text("Hello world")

    output_base = str(tmp_path / "output")
    create_thumbnail_from_text(str(text_file), output_base)

    cover = f"{output_base}-cover.jpg"
    assert os.path.exists(cover)
    img = Image.open(cover)
    assert img.size == (128, 128)


def test_create_thumbnail_from_text_nonexistent_file(tmp_path, caplog):
    """Test that a missing file logs an error and doesn't create output."""

    output_base = str(tmp_path / "out")
    create_thumbnail_from_text("/nonexistent/file.txt", output_base)

    assert not os.path.exists(f"{output_base}-cover.jpg")
    assert "Cannot read text file" in caplog.text


def test_create_thumbnail_dispatches_text(tmp_path):
    """Test that create_thumbnail routes text files to the text handler."""

    text_file = tmp_path / "file.txt"
    text_file.write_text("content")

    output_base = str(tmp_path / "out")
    create_thumbnail(str(text_file), output_base)

    assert os.path.exists(f"{output_base}-cover.jpg")


def test_create_thumbnail_dispatches_md(tmp_path):
    """Test that create_thumbnail routes .md files to the text handler."""

    text_file = tmp_path / "readme.md"
    text_file.write_text("# Hello")

    output_base = str(tmp_path / "out")
    create_thumbnail(str(text_file), output_base)

    assert os.path.exists(f"{output_base}-cover.jpg")
