"""Thumbnail creation utilities.

This module provides functions for creating thumbnails from various file types,
including images, PDFs, and videos. Thumbnails are created at 128x128 pixels
and saved as JPEG or PNG files.
"""
import logging
import subprocess

from PIL import Image

from .util import is_image, is_pdf, is_video

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
        ]
    )

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
