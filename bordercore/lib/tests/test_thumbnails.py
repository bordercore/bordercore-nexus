import os

from PIL import Image

from lib.thumbnails import (
    _get_font,
    create_thumbnail,
    create_thumbnail_from_text,
    render_text_thumbnail,
)


class TestRenderTextThumbnail:
    """Tests for render_text_thumbnail."""

    def test_returns_correct_size_and_mode(self):
        img = render_text_thumbnail("Title", "Body text")
        assert img.size == (128, 128)
        assert img.mode == "RGB"

    def test_title_only(self):
        img = render_text_thumbnail("Title", "")
        assert img.size == (128, 128)

    def test_content_only(self):
        img = render_text_thumbnail("", "Some body text here")
        assert img.size == (128, 128)

    def test_empty_title_and_content(self):
        img = render_text_thumbnail("", "")
        assert img.size == (128, 128)

    def test_long_title_is_truncated(self):
        """A title longer than the thumbnail width should not cause errors."""
        long_title = "A" * 200
        img = render_text_thumbnail(long_title, "body")
        assert img.size == (128, 128)

    def test_long_content_does_not_overflow(self):
        """Content that exceeds vertical space should be clipped, not error."""
        long_content = "word " * 500
        img = render_text_thumbnail("Title", long_content)
        assert img.size == (128, 128)

    def test_multiline_content(self):
        content = "Line one\nLine two\nLine three"
        img = render_text_thumbnail("Title", content)
        assert img.size == (128, 128)


class TestCreateThumbnailFromText:
    """Tests for create_thumbnail_from_text."""

    def test_creates_cover_jpg(self, tmp_path):
        text_file = tmp_path / "notes.txt"
        text_file.write_text("Hello world")

        output_base = str(tmp_path / "output")
        create_thumbnail_from_text(str(text_file), output_base)

        cover = f"{output_base}-cover.jpg"
        assert os.path.exists(cover)
        img = Image.open(cover)
        assert img.size == (128, 128)

    def test_title_derived_from_filename(self, tmp_path):
        """The stem of the filename should be used as the title."""
        text_file = tmp_path / "my-document.md"
        text_file.write_text("# Heading\nSome markdown content")

        output_base = str(tmp_path / "out")
        create_thumbnail_from_text(str(text_file), output_base)

        assert os.path.exists(f"{output_base}-cover.jpg")

    def test_reads_utf8_content(self, tmp_path):
        text_file = tmp_path / "unicode.txt"
        text_file.write_text("Héllo wörld — emoji: \U0001f600", encoding="utf-8")

        output_base = str(tmp_path / "out")
        create_thumbnail_from_text(str(text_file), output_base)

        assert os.path.exists(f"{output_base}-cover.jpg")

    def test_empty_file(self, tmp_path):
        text_file = tmp_path / "empty.txt"
        text_file.write_text("")

        output_base = str(tmp_path / "out")
        create_thumbnail_from_text(str(text_file), output_base)

        assert os.path.exists(f"{output_base}-cover.jpg")

    def test_nonexistent_file_logs_error(self, tmp_path, caplog):
        output_base = str(tmp_path / "out")
        create_thumbnail_from_text("/nonexistent/file.txt", output_base)

        assert not os.path.exists(f"{output_base}-cover.jpg")
        assert "Cannot read text file" in caplog.text


class TestCreateThumbnailDispatch:
    """Test that create_thumbnail dispatches to text handler."""

    def test_dispatches_txt(self, tmp_path):
        text_file = tmp_path / "file.txt"
        text_file.write_text("content")

        output_base = str(tmp_path / "out")
        create_thumbnail(str(text_file), output_base)

        assert os.path.exists(f"{output_base}-cover.jpg")

    def test_dispatches_md(self, tmp_path):
        text_file = tmp_path / "file.md"
        text_file.write_text("# Title")

        output_base = str(tmp_path / "out")
        create_thumbnail(str(text_file), output_base)

        assert os.path.exists(f"{output_base}-cover.jpg")

    def test_dispatches_csv(self, tmp_path):
        text_file = tmp_path / "data.csv"
        text_file.write_text("a,b,c\n1,2,3")

        output_base = str(tmp_path / "out")
        create_thumbnail(str(text_file), output_base)

        assert os.path.exists(f"{output_base}-cover.jpg")

    def test_unknown_extension_no_thumbnail(self, tmp_path):
        unknown_file = tmp_path / "file.xyz"
        unknown_file.write_text("stuff")

        output_base = str(tmp_path / "out")
        create_thumbnail(str(unknown_file), output_base)

        assert not os.path.exists(f"{output_base}-cover.jpg")


class TestGetFont:
    """Tests for _get_font."""

    def test_returns_font_object(self):
        font = _get_font(10)
        assert font is not None

    def test_different_sizes(self):
        font_small = _get_font(8)
        font_large = _get_font(16)
        assert font_small is not None
        assert font_large is not None
