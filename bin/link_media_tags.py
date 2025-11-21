"""
Create tag-based symlinks for video Blob files.

This script scans /home/media/blobs/, where each subdirectory is named
after a Blob.uuid. For each Blob whose file has a supported video
extension, it finds all associated tags and creates symlinks under:

    /home/media/tags/{tagname}/

Each symlink is named after the original filename and points back to
the Blob's on-disk file. Existing paths are skipped.

Supported video extensions (case-insensitive):
    .mp4, .mov, .mkv, .webm, .m4v, .avi, .flv,
    .wmv, .mpg, .mpeg, .3gp, .ts, .mts, .m2ts

Use "-n/--dry-run" to see what would happen without changing the
filesystem.
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from pathlib import Path
from typing import Any, Tuple, Type

import django

# Adjust this to your Django settings module
DJANGO_SETTINGS_MODULE = "myproject.settings"

BLOB_ROOT = Path("/home/media/blobs")
TAG_ROOT = Path("/home/media/tags")

# All supported video extensions (lowercase, without leading dot)
SUPPORTED_VIDEO_EXTENSIONS = {
    "mp4",
    "mov",
    "mkv",
    "webm",
    "m4v",
    "avi",
    "flv",
    "wmv",
    "mpg",
    "mpeg",
    "3gp",
    "ts",
    "mts",
    "m2ts",
}


def setup_django() -> None:
    """Initialize Django so ORM models can be used."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", DJANGO_SETTINGS_MODULE)
    django.setup()


def get_blob_model() -> Type[Any]:
    """Return the Blob model class."""
    from blob.models import Blob  # type: ignore[import]

    return Blob


def sanitize_tag_name(tag_name: str) -> str:
    """Return a filesystem-safe directory name for a tag.

    Args:
        tag_name: Original tag name from the database.

    Returns:
        A sanitized tag name safe to use as a directory component.
    """
    safe = tag_name.strip()
    safe = safe.replace(os.sep, "_")
    # Also prevent accidental parent traversal.
    safe = safe.replace("..", "__")
    return safe


def is_supported_video_filename(filename: str) -> bool:
    """Check whether a filename has a supported video extension.

    Args:
        filename: Filename or path string.

    Returns:
        True if the filename has a supported extension, False otherwise.
    """
    lower = filename.lower()
    return any(lower.endswith(f".{ext}") for ext in SUPPORTED_VIDEO_EXTENSIONS)


def find_blob_for_uuid(blob_model: Type[Any], uuid_dir: Path) -> Any | None:
    """Look up the Blob instance matching a UUID directory.

    Args:
        blob_model: Blob model class.
        uuid_dir: Path object representing the UUID directory.

    Returns:
        The Blob instance if found, otherwise None.
    """
    try:
        blob_uuid = uuid.UUID(uuid_dir.name)
    except ValueError:
        return None

    try:
        blob = blob_model.objects.filter(uuid=blob_uuid).first()
    except Exception as exc:  # pragma: no cover - defensive
        print(f"Error querying Blob for {uuid_dir.name}: {exc}", file=sys.stderr)
        return None

    return blob


def get_blob_source_file(blob: Any, uuid_dir: Path) -> Path | None:
    """Determine the source video file path for a Blob within its UUID directory.

    Args:
        blob: Blob instance.
        uuid_dir: Base directory for this blob's files.

    Returns:
        The Path to the video file, or None if not a supported video
        or the file is missing.
    """
    if not getattr(blob, "file", None):
        return None

    filename = Path(str(blob.file.name)).name
    if not is_supported_video_filename(filename):
        return None

    source_file = uuid_dir / filename
    if not source_file.exists():
        print(
            f"Warning: expected video file not found on disk: {source_file}",
            file=sys.stderr,
        )
        return None

    return source_file


def ensure_tag_dir(tag_name: str, dry_run: bool) -> Path:
    """Ensure the tag directory exists (or would exist in dry-run).

    Args:
        tag_name: Tag name from the database.
        dry_run: If True, do not actually create directories.

    Returns:
        Path to the tag directory.
    """
    safe_name = sanitize_tag_name(tag_name)
    tag_dir = TAG_ROOT / safe_name

    if dry_run:
        if not tag_dir.exists():
            print(f"[DRY-RUN] Would create directory: {tag_dir}")
        return tag_dir

    tag_dir.mkdir(parents=True, exist_ok=True)
    return tag_dir


def create_symlink(source: Path, dest: Path, dry_run: bool) -> Tuple[bool, str]:
    """Create a symlink from dest -> source if it does not already exist.

    Args:
        source: Path to the original file.
        dest: Path for the symlink.
        dry_run: If True, do not actually create the symlink.

    Returns:
        Tuple of (created, message). created is True if a new symlink
        was created (or would be created in dry-run), False if skipped.
    """
    if os.path.lexists(dest):
        return False, f"Skip existing: {dest}"

    if dry_run:
        return True, f"[DRY-RUN] Would create symlink: {dest} -> {source}"

    try:
        os.symlink(source, dest)
        return True, f"Created symlink: {dest} -> {source}"
    except OSError as exc:  # pragma: no cover - defensive
        return False, f"Error creating symlink {dest} -> {source}: {exc}"


def process_blobs(dry_run: bool) -> Tuple[int, int]:
    """Scan all blob directories and create tag-based symlinks for videos.

    Args:
        dry_run: If True, do not modify the filesystem.

    Returns:
        A tuple (created_count, skipped_count).
    """
    blob_model = get_blob_model()

    created_count = 0
    skipped_count = 0

    if not BLOB_ROOT.is_dir():
        print(f"Error: blob root does not exist or is not a directory: {BLOB_ROOT}")
        return created_count, skipped_count

    for uuid_dir in sorted(BLOB_ROOT.iterdir()):
        if not uuid_dir.is_dir():
            continue

        blob = find_blob_for_uuid(blob_model, uuid_dir)
        if blob is None:
            continue

        source_file = get_blob_source_file(blob, uuid_dir)
        if source_file is None:
            continue

        tags_manager = getattr(blob, "tags", None)
        if tags_manager is None or not tags_manager.exists():
            continue

        for tag in tags_manager.all():
            tag_dir = ensure_tag_dir(tag.name, dry_run=dry_run)
            dest = tag_dir / source_file.name

            created, msg = create_symlink(source_file, dest, dry_run=dry_run)
            print(msg)
            if created:
                created_count += 1
            else:
                skipped_count += 1

    return created_count, skipped_count


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments.

    Args:
        argv: Optional list of argument strings.

    Returns:
        Parsed arguments namespace.
    """
    parser = argparse.ArgumentParser(
        description="Create tag-based symlinks for video Blob files."
    )
    parser.add_argument(
        "-n",
        "--dry-run",
        action="store_true",
        help="Show what would be done without creating directories or symlinks.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    """CLI entry point."""
    args = parse_args(argv)

    setup_django()
    dry_run = args.dry_run

    mode_label = "DRY-RUN" if dry_run else "LIVE"
    print(f"Starting video tag-linker ({mode_label} mode)")
    print(f"Blob root: {BLOB_ROOT}")
    print(f"Tag root: {TAG_ROOT}")
    print(
        "Supported video extensions: "
        + ", ".join(sorted(f".{ext}" for ext in SUPPORTED_VIDEO_EXTENSIONS))
    )

    created, skipped = process_blobs(dry_run=dry_run)

    if dry_run:
        print(
            f"[DRY-RUN] Would create {created} new symlinks; "
            f"{skipped} paths already exist and would be skipped."
        )
    else:
        print(f"Created {created} new symlinks; skipped {skipped} existing paths.")


if __name__ == "__main__":
    main()
