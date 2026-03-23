"""Thumbnail creation utilities.

This module provides functions for creating thumbnails from various file types,
including images, PDFs, and videos. Thumbnails are created at 128x128 pixels
and saved as JPEG or PNG files.
"""
import logging
import subprocess
import textwrap

from PIL import Image, ImageDraw, ImageFont

from .util import is_image, is_pdf, is_text, is_video

# Thumbnail dimensions in pixels (width, height)
THUMBNAIL_SIZE = (128, 128)

log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)


def create_thumbnail(infile: str, output_base: str, page_number: int = 1) -> None:
    """Create a thumbnail from an image, PDF, or video file.

    Determines the file type and calls the appropriate thumbnail creation
    function. Supports images, PDFs, and videos.

    Args:
        infile: Path to the input file.
        output_base: Base path prefix for output files (thumbnail will be saved as
            "{output_base}-cover.jpg").
        page_number: Page number to use for PDF files (1-indexed). Defaults to 1.
    """
    if is_image(infile):
        create_thumbnail_from_image(infile, output_base)
    elif is_pdf(infile):
        create_thumbnail_from_pdf(infile, output_base, page_number)
    elif is_video(infile):
        create_thumbnail_from_video(infile, output_base)
    elif is_text(infile):
        create_thumbnail_from_text(infile, output_base)
    else:
        log.warning("Can't create thumbnail from this type of file")


def create_thumbnail_from_image(infile: str, output_base: str) -> None:
    """Create a thumbnail from an image file.

    Opens the image, converts it to RGB mode, resizes it to 128x128 pixels,
    and saves it as a JPEG thumbnail.

    Args:
        infile: Path to the input image file.
        output_base: Base path prefix for output file (thumbnail will be saved as
            "{output_base}-cover.jpg").
    """
    try:
        # Convert images to RGB mode to avoid "cannot write mode P as JPEG" errors for PNGs
        im = Image.open(infile).convert("RGB")
        im.thumbnail(THUMBNAIL_SIZE)
        im.save(f"{output_base}-cover.jpg")
    except IOError as err:
        log.error("Cannot create thumbnail; error=%s", err)


def create_thumbnail_from_pdf(infile: str, output_base: str, page_number: int = 1) -> None:
    """Create a thumbnail from a PDF file.

    Extracts a page from the PDF, renders it as an image at 150 DPI, saves
    it as a large cover image, then creates a small thumbnail from it.

    Args:
        infile: Path to the input PDF file.
        output_base: Base path prefix for output files (large cover will be saved as
            "{output_base}-cover-large.jpg" and thumbnail as "{output_base}-cover.jpg").
        page_number: Page number to use (1-indexed). Defaults to 1.

    Note:
        The PyMuPDF (fitz) import is done here so that AWS lambdas using
        other functions in this module don't need to install the PyMuPDF
        package.
    """
    import fitz

    page_number = page_number - 1
    cover_large = f"{output_base}-cover-large.jpg"

    doc = fitz.open(infile)
    page = doc.load_page(page_number)
    pix = page.get_pixmap(dpi=150)
    pix.pil_save(cover_large)

    create_small_cover_image(cover_large, output_base)


def create_thumbnail_from_video(infile: str, output_base: str) -> None:
    """Create a thumbnail from a video file.

    Extracts a frame from the video at 1 second using ffmpeg, saves it as
    a large cover image, then creates a small thumbnail from it.

    Args:
        infile: Path to the input video file.
        output_base: Base path prefix for output files (large cover will be saved as
            "{output_base}-cover-large.jpg" and thumbnail as "{output_base}-cover.jpg").
    """
    thumbnail_filename = f"{output_base}-cover-large.jpg"

    try:
        subprocess.run(
            [
                "/usr/local/bin/ffmpeg",
                "-ss",
                "00:00:01",
                "-i",
                infile,
                "-vframes",
                "1",
                "-q:v",
                "2",
                thumbnail_filename
            ],
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError as err:
        log.error("ffmpeg failed for %s; returncode=%s, stderr=%s", infile, err.returncode, err.stderr)
        return

    create_small_cover_image(thumbnail_filename, output_base)


def create_small_cover_image(cover_large: str, output_base: str) -> None:
    """Resize the large cover image to create a small thumbnail.

    Opens the large cover image, resizes it to 128x128 pixels, and saves
    it as a JPEG thumbnail.

    Args:
        cover_large: Path to the large cover image file.
        output_base: Base path prefix for output file (thumbnail will be saved as
            "{output_base}-cover.jpg").
    """
    try:
        im = Image.open(cover_large)
        im.thumbnail(THUMBNAIL_SIZE)
        im.save(f"{output_base}-cover.jpg", "JPEG")
    except IOError as err:
        log.error("Cannot create small thumbnail for %s; error=%s", cover_large, err)


def create_thumbnail_from_text(infile: str, output_base: str) -> None:
    """Create a thumbnail from a text file.

    Reads the file content and renders a document-style preview with the
    filename as a title and body text wrapped to fit a 128x128 image.

    Args:
        infile: Path to the source text file.
        output_base: Base path prefix for output file (thumbnail will be saved as
            "{output_base}-cover.jpg").
    """
    from pathlib import PurePath

    title = PurePath(infile).stem
    try:
        with open(infile, "r", encoding="utf-8", errors="replace") as f:
            content = f.read(4096)
    except IOError as err:
        log.error("Cannot read text file for thumbnail; error=%s", err)
        return

    img = render_text_thumbnail(title, content)
    img.save(f"{output_base}-cover.jpg", "JPEG")


def _get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Try to load a font at the given size, fall back to default."""
    font_paths = [
        # Amazon Linux (Lambda base image)
        "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf",
        # Debian/Ubuntu
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    ]
    for path in font_paths:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


# Layout constants for text thumbnails
_THUMB_SIZE = (128, 128)
_PADDING = 8
_LINE_SPACING = 2
_BG_COLOR = (30, 30, 30)
_TEXT_COLOR = (190, 190, 190)
_TITLE_COLOR = (230, 230, 230)
_BORDER_COLOR = (70, 70, 70)


def render_text_thumbnail(title: str, content: str) -> Image.Image:
    """Render a text preview thumbnail.

    Creates a 128x128 image with the title at the top, followed by
    wrapped body text in a smaller font.

    Args:
        title: Heading text (e.g. filename without extension).
        content: Body text content.

    Returns:
        A PIL Image (RGB, 128x128).
    """
    img = Image.new("RGB", _THUMB_SIZE, _BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Draw a subtle border
    draw.rectangle(
        [0, 0, _THUMB_SIZE[0] - 1, _THUMB_SIZE[1] - 1],
        outline=_BORDER_COLOR,
    )

    title_font = _get_font(10)
    body_font = _get_font(8)

    y = _PADDING
    usable_width = _THUMB_SIZE[0] - 2 * _PADDING

    # Draw title (truncated to fit)
    if title:
        avg_char_width = title_font.getlength("M") if hasattr(title_font, "getlength") else 7
        max_chars = max(1, int(usable_width / avg_char_width))
        display_title = title[:max_chars]
        if len(title) > max_chars:
            display_title = display_title[:-1] + "\u2026"

        draw.text((_PADDING, y), display_title, fill=_TITLE_COLOR, font=title_font)
        y += int(getattr(title_font, "size", 10)) + 4

        # Draw a thin separator line
        draw.line([(_PADDING, y), (_THUMB_SIZE[0] - _PADDING, y)], fill=_BORDER_COLOR)
        y += 4

    # Draw body text (wrapped)
    if content:
        avg_char_width = body_font.getlength("m") if hasattr(body_font, "getlength") else 5
        wrap_width = max(1, int(usable_width / avg_char_width))
        line_height: int = int(getattr(body_font, "size", 8)) + _LINE_SPACING

        wrapped = textwrap.fill(content, width=wrap_width)
        for line in wrapped.splitlines():
            if y + line_height > _THUMB_SIZE[1] - _PADDING:
                break
            draw.text((_PADDING, y), line, fill=_TEXT_COLOR, font=body_font)
            y += line_height

    return img


def create_bookmark_thumbnail(cover_large: str, out_file: str) -> None:
    """Resize the large cover image to create a small bookmark thumbnail.

    Opens the large cover image, resizes it to 128x128 pixels, and saves
    it as a PNG thumbnail.

    Args:
        cover_large: Path to the large cover image file.
        out_file: Path where the thumbnail should be saved.
    """
    try:
        im = Image.open(cover_large)
        im.thumbnail(THUMBNAIL_SIZE)
        im.save(out_file, "PNG")
    except IOError as err:
        log.error("Cannot create thumbnail for %s; error=%s", cover_large, err)
