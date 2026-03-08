"""
Management command to sync music files from S3 to the local filesystem.

This script supports syncing individual songs, entire directories, or album-based
tracks by extracting ID3 tags and organizing the files into a music directory
structure. It verifies that songs exist in the database before syncing and can
optionally run in dry-run mode.

Args:
    --uuid (str): The UUID of the song to download from S3.
    --directory (str): Directory containing songs to sync.
    --album-name (str): Album name for syncing.
    --file-name (str): Individual filename to sync.
    --artist (str): Artist name (overrides ID3 tag).
    --title (str): Song title (overrides ID3 tag).
    --sync-album-song (bool): Indicates that the song is part of an album.
    --song-uuid (str): The UUID of the song in the database.
    --dry-run (bool): Run without making changes.
"""

from __future__ import annotations

import logging
import os
import re
from argparse import ArgumentParser
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from mutagen.easyid3 import EasyID3
from mutagen.id3._util import ID3NoHeaderError

try:
    from colorama import Fore, Style
except ModuleNotFoundError:
    # Don't worry if this import doesn't exist in production:
    pass

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db.models.query import QuerySet
from django.db.transaction import atomic

from music.models import Song

logger = logging.getLogger(__name__)


@dataclass
class SongMetadata:
    """Data class to hold song metadata.

    Attributes:
        artist: The name of the artist.
        title: The title of the song.
        album_name: The name of the album, if applicable.
        track_number: The track number on the album, if applicable.
    """
    artist: str
    title: str
    album_name: str | None = None
    track_number: str | None = None

    def __post_init__(self) -> None:
        """Validate required fields after initialization.

        Raises:
            ValueError: If artist or title is empty or None.
        """
        if not self.artist:
            raise ValueError("Artist is required")
        if not self.title:
            raise ValueError("Title is required")


class MusicSyncError(Exception):
    """Custom exception for music sync operations."""


class Command(BaseCommand):
    """Django management command to sync music files from S3 to local filesystem.

    This command supports downloading a song by UUID, syncing all songs in a directory,
    or syncing individual files. It reads metadata from ID3 tags or accepts overrides
    via command-line options. It verifies songs against the database before organizing
    and moving them into a structured local directory layout.

    Attributes:
        help: Help text displayed for this command.
        music_dir: Base directory for music files.
        s3_client: Boto3 S3 client instance.
        dry_run: Whether to run in dry-run mode.
    """
    help = "Sync music from S3 to local filesystem"

    def __init__(self, *args: Any, **kwargs: Any):
        """Initialize the command with default settings.

        Args:
            *args: Variable length argument list.
            **kwargs: Arbitrary keyword arguments.
        """
        super().__init__(*args, **kwargs)
        self.music_dir = getattr(settings, "MUSIC_DIR", "/home/media/music")
        self.s3_client = None
        self.dry_run = False

    def add_arguments(self, parser: ArgumentParser) -> None:
        """Add custom arguments to the management command parser.

        Args:
            parser: The argument parser instance to add arguments to.
        """
        parser.add_argument(
            "--uuid", "-u",
            help="The UUID of the song to download",
        )
        parser.add_argument(
            "--directory", "-d",
            help="The directory of songs to sync",
        )
        parser.add_argument(
            "--album-name", "-l",
            help="The album name to sync",
        )
        parser.add_argument(
            "--file-name", "-f",
            help="The filename to sync",
        )
        parser.add_argument(
            "--artist", "-a",
            help="The song artist (overrides ID3 tag)",
        )
        parser.add_argument(
            "--title", "-t",
            help="The song title (overrides ID3 tag)",
        )
        parser.add_argument(
            "--sync-album-song", "-s",
            help="Sync a song as part of an album",
            action="store_true"
        )
        parser.add_argument(
            "--song-uuid", "-i",
            help="The song UUID",
        )
        parser.add_argument(
            "--dry-run", "-n",
            help="Dry run. Take no action",
            action="store_true"
        )

    @atomic
    def handle(self, *args: Any, **options: Any) -> None:
        """Main entry point for the management command.

        Processes command line arguments and delegates to appropriate sync methods.
        Handles exceptions and provides logging for the sync operation.

        Args:
            *args: Variable length argument list (unused).
            **options: Dictionary of command line options including:
                - uuid: UUID of song to download from S3
                - directory: Directory path to sync
                - file_name: Single file to sync
                - artist: Artist name override
                - title: Song title override
                - album_name: Album name override
                - song_uuid: Song UUID for database lookup
                - sync_album_song: Whether to treat as album song
                - dry_run: Whether to run in dry-run mode

        Raises:
            CommandError: If sync operation fails or invalid arguments provided.
            MusicSyncError: If the sync operation fails
        """
        self.dry_run = options.get("dry_run", False)

        try:
            if options.get("uuid"):
                self._download_from_s3(options["uuid"])
            elif options.get("directory"):
                self._sync_directory(
                    options["directory"],
                    options.get("artist"),
                    options.get("album_name"),
                    options.get("sync_album_song", False)
                )
            elif options.get("file_name"):
                self._sync_file(
                    options["file_name"],
                    options.get("artist"),
                    options.get("title"),
                    options.get("album_name"),
                    options.get("song_uuid"),
                    options.get("sync_album_song", False)
                )
            else:
                self.stdout.write(
                    f"{Fore.YELLOW}No file or directory specified. "
                    f"Processing the current directory...{Style.RESET_ALL}"
                )
                self._sync_directory(
                    ".",
                    options.get("artist"),
                    options.get("album_name"),
                    options.get("sync_album_song", False)
                )
        except (MusicSyncError, CommandError) as e:
            self.stdout.write(f"{Fore.RED}{e}{Style.RESET_ALL}")
            # logger.error("Sync failed: %s", e)
        except Exception as e:
            logger.exception("Unexpected error during sync")
            raise CommandError(f"Unexpected error: {e}") from e

    def _get_s3_client(self) -> boto3.client:
        """Lazy initialization of S3 client with error handling.

        Creates and caches an S3 client instance for downloading files.
        Only creates the client when first needed to avoid unnecessary
        AWS credential validation.

        Returns:
            Configured S3 client instance.

        Raises:
            MusicSyncError: If AWS credentials are not properly configured.
        """
        if self.s3_client is None:
            try:
                self.s3_client = boto3.client("s3")
            except NoCredentialsError as e:
                raise MusicSyncError("AWS credentials not configured") from e
        return self.s3_client

    def _get_artist_directory(self, song: QuerySet[Song], artist: str) -> str:
        """Determine or create the directory for the given artist.

        Creates a directory structure based on the first letter of the artist name.
        Handles special cases like compilation albums which go under "Various Artists".

        Args:
            song: QuerySet containing the matching song(s) for directory determination.
            artist: Name of the artist to create directory for.

        Returns:
            Absolute path string to the artist directory.

        Raises:
            MusicSyncError: If no song object found or artist name is invalid.
        """
        song_obj = song.first()

        if song_obj is None:
            raise MusicSyncError("No song object found to determine artist directory")

        # Determine first letter for directory structure
        first_letter = re.sub(r"\W+", "", artist).lower()
        if not first_letter:
            raise MusicSyncError(f"Cannot determine first letter for artist: {artist}")
        first_letter_dir = first_letter[0]

        # Handle compilation albums
        if song_obj.album and song_obj.album.compilation:
            artist_dir = Path(self.music_dir) / "v" / "Various"
        else:
            artist_dir = Path(self.music_dir) / first_letter_dir / self._sanitize_filename(artist)

        self._ensure_directory_exists(artist_dir)
        return str(artist_dir)

    def _create_album_directory(self, artist_dir: str, album: str) -> None:
        """Create a directory for the album inside the artist's directory.

        Args:
            artist_dir: Path to the artist's directory.
            album: Name of the album to create directory for.
        """
        album_dir = Path(artist_dir) / album
        self._ensure_directory_exists(album_dir)

    def _ensure_directory_exists(self, directory: Path) -> None:
        """Ensure a directory exists, creating it if necessary.

        Creates the directory and any necessary parent directories.
        Respects dry-run mode by only logging the action without creating.

        Args:
            directory: Path object representing the directory to create.
        """
        if not directory.exists():
            self.stdout.write(f"{Fore.GREEN}Creating directory {directory}{Style.RESET_ALL}")
            if not self.dry_run:
                directory.mkdir(parents=True, exist_ok=True)

    def _get_file_path(
        self,
        artist_dir: str,
        metadata: SongMetadata,
        is_album_song: bool
    ) -> str:
        """Construct the file path for the song based on context.

        Creates the appropriate file path depending on whether the song is part
        of an album or a standalone track. Album songs include track numbers
        in the filename and are placed in album subdirectories.

        Args:
            artist_dir: Path to the artist's directory.
            metadata: Song metadata containing title, album, and track info.
            is_album_song: Whether this song is part of an album.

        Returns:
            Full absolute path where the song file should be saved.
        """
        sanitized_title = self._sanitize_filename(metadata.title)

        if is_album_song and metadata.album_name and metadata.track_number:
            return str(Path(artist_dir) / metadata.album_name / f"{metadata.track_number} - {sanitized_title}.mp3")
        return str(Path(artist_dir) / f"{sanitized_title}.mp3")

    def _normalize_track_number(self, track_number: str) -> str:
        """Pad single-digit track numbers with a leading zero.

        Handles track numbers in various formats (e.g., "1", "1/12") and
        normalizes them to zero-padded two-digit format for consistent sorting.

        Args:
            track_number: Raw track number string from ID3 tags.

        Returns:
            Normalized track number string (e.g., "01", "12").
        """
        # Handle track numbers like "1/12"
        track_num = track_number.split("/")[0].strip()
        return track_num.zfill(2)

    def _sanitize_filename(self, name: str) -> str:
        """Replace unsafe characters in filenames with safe alternatives.

        Removes or replaces characters that are not allowed in filenames
        on most filesystems, including Windows-specific restrictions.

        Args:
            name: Raw filename or path component.

        Returns:
            Sanitized filename safe for use on most filesystems.
        """
        if not name:
            return ""
        # More comprehensive filename sanitization
        sanitized = re.sub(r'[<>"/\\|?*]', "-", name)
        return sanitized.strip()

    def _download_from_s3(self, uuid: str) -> None:
        """Download a song file from S3 using its UUID.

        Retrieves song metadata from the database, constructs an appropriate
        filename, and downloads the file from the configured S3 bucket.

        Args:
            uuid: UUID of the song to download from S3.

        Raises:
            MusicSyncError: If song not found in database or S3 download fails.
        """
        try:
            song = Song.objects.get(uuid=uuid)
        except Song.DoesNotExist as e:
            raise MusicSyncError(f"Song with UUID {uuid} not found in database") from e

        if song.album:
            track_number = self._normalize_track_number(str(song.track))
            filename = f"{track_number} - {song.title}.mp3"
        else:
            filename = f"{song.title}.mp3"

        filename = self._sanitize_filename(filename)

        try:
            s3_client = self._get_s3_client()
            if not self.dry_run:
                s3_client.download_file(
                    settings.AWS_BUCKET_NAME_MUSIC,
                    f"songs/{uuid}",
                    filename
                )
            self.stdout.write(f"{Fore.GREEN}Downloaded '{filename}'{Style.RESET_ALL}")
        except ClientError as e:
            raise MusicSyncError(f"Failed to download from S3: {e}") from e

    def _sanitize_tag(self, value: str) -> str:
        """Clean up ID3 tag values by removing unwanted suffixes.

        Removes common suffixes like "[Explicit]" that may appear in
        ID3 tags but are not desired in filenames or database entries.

        Args:
            value: Raw ID3 tag value.

        Returns:
            Cleaned tag value with unwanted suffixes removed.
        """
        if not value:
            return ""
        return value.replace(" [Explicit]", "").strip()

    def _get_id3_tag(self, tag_name: str, id3_info: dict, required: bool = True) -> str | None:
        """Extract a tag value from ID3 metadata with validation.

        Retrieves the specified tag from the ID3 metadata dictionary,
        applies sanitization, and handles missing required tags.

        Args:
            tag_name: The name of the ID3 tag to extract (e.g., 'artist', 'title').
            id3_info: Dictionary of parsed ID3 metadata.
            required: Whether to raise an error if the tag is missing.

        Returns:
            The sanitized tag value if present, None if optional and missing.

        Raises:
            MusicSyncError: If the tag is required but missing or empty.
        """
        if tag_name in id3_info and id3_info[tag_name]:
            return self._sanitize_tag(id3_info[tag_name][0])

        if required:
            raise MusicSyncError(f"Required tag '{tag_name}' not found in file")
        return None

    def _sync_directory(
        self,
        directory: str,
        artist: str | None,
        album_name: str | None,
        is_album_song: bool
    ) -> None:
        """Sync all MP3 files in a directory recursively.

        Scans the specified directory for MP3 files and processes each one
        individually. Continues processing even if individual files fail,
        logging errors for failed files.

        Args:
            directory: Path to the directory to scan for MP3 files.
            artist: Optional artist name override for all files.
            album_name: Optional album name override for all files.
            is_album_song: Whether to treat all files as album songs.

        Raises:
            MusicSyncError: If the directory path is invalid or inaccessible.
        """
        dir_path = Path(directory)
        if not dir_path.is_dir():
            raise MusicSyncError(f"{directory} is not a directory")

        mp3_files = list(dir_path.glob("**/*.mp3"))
        if not mp3_files:
            self.stdout.write(f"{Fore.YELLOW}No MP3 files found in {directory}{Style.RESET_ALL}")
            return

        self.stdout.write(f"Found {len(mp3_files)} MP3 file{'s' if len(mp3_files) != 1 else ''} to process")

        for path in mp3_files:
            try:
                self._sync_file(
                    str(path),
                    artist,
                    None,
                    album_name,
                    None,
                    is_album_song
                )
            except (MusicSyncError, CommandError) as e:
                self.stdout.write(f"{Fore.RED}Failed to sync {path}: {e}{Style.RESET_ALL}")
                continue

    def _sync_file(
        self,
        filename: str,
        artist: str | None,
        title: str | None,
        album_name: str | None,
        song_uuid: str | None,
        is_album_song: bool
    ) -> None:
        """Sync an individual song file by organizing and moving it to the correct path.

        Processes a single MP3 file by:
        1. Reading ID3 metadata
        2. Resolving final metadata (args override ID3)
        3. Verifying song exists in database
        4. Creating appropriate directory structure
        5. Moving file to final location

        Args:
            filename: Path to the MP3 file to sync.
            artist: Optional artist name override.
            title: Optional song title override.
            album_name: Optional album name override.
            song_uuid: Optional UUID for direct database lookup.
            is_album_song: Whether to treat as part of an album.

        Raises:
            MusicSyncError: If file doesn't exist, metadata is invalid,
                          song not found in database, or file operation fails.
        """
        file_path = Path(filename)
        if not file_path.exists():
            raise MusicSyncError(f"File not found: {filename}")

        self.stdout.write(f"{Fore.GREEN}{Style.BRIGHT}Syncing '{filename}'{Style.RESET_ALL}")

        try:
            id3_info = self._get_id3_info(filename)
            metadata = self._resolve_metadata(id3_info, artist, title, album_name, is_album_song)
            song_queryset = self._verify_song_in_db(metadata, song_uuid, is_album_song)

            artist_dir = self._get_artist_directory(song_queryset, metadata.artist)

            if is_album_song and metadata.album_name:
                self._create_album_directory(artist_dir, metadata.album_name)

            target_path = self._get_file_path(artist_dir, metadata, is_album_song)

            if Path(target_path).exists():
                self.stdout.write(
                    f"{Fore.RED}File already exists: '{target_path}' Skipping...{Style.RESET_ALL}"
                )
                return

            if not self.dry_run:
                os.rename(filename, target_path)

            self.stdout.write(f"{Fore.GREEN}Moved song to {target_path}{Style.RESET_ALL}")

        except Exception as e:
            raise MusicSyncError(f"Failed to sync {filename}: {e}") from e

    def _get_id3_info(self, filename: str) -> dict:
        """Extract ID3 metadata from the file, or return empty dict if unavailable.

        Attempts to read ID3 tags from the MP3 file using the EasyID3 format.
        Gracefully handles files without ID3 headers or other read errors.

        Args:
            filename: Path to the MP3 file to read.

        Returns:
            Dictionary of ID3 tag metadata, empty dict if no tags available.
        """
        try:
            return dict(EasyID3(filename))
        except ID3NoHeaderError:
            logger.warning("No ID3 header found in %s", filename)
            return {}
        except Exception as e:
            logger.warning("Failed to read ID3 tags from %s: %s", filename, e)
            return {}

    def _resolve_metadata(
        self,
        id3_info: dict,
        artist: str | None,
        title: str | None,
        album_name: str | None,
        is_album_song: bool
    ) -> SongMetadata:
        """Resolve metadata by combining command line arguments with ID3 tags.

        Prioritizes command line arguments over ID3 tags for metadata values.
        Validates that required fields are present and handles special cases
        for album songs that require additional metadata.

        Args:
            id3_info: Dictionary of ID3 tag metadata from the file.
            artist: Optional artist name from command line arguments.
            title: Optional song title from command line arguments.
            album_name: Optional album name from command line arguments.
            is_album_song: Whether the song should be treated as part of an album.

        Returns:
            SongMetadata object with resolved and validated metadata.

        Raises:
            MusicSyncError: If required metadata is missing or invalid for the context.
        """
        resolved_artist = artist or self._get_id3_tag("artist", id3_info)
        resolved_title = title or self._get_id3_tag("title", id3_info)
        resolved_album = album_name or self._get_id3_tag("album", id3_info, required=False)

        if not resolved_artist:
            raise MusicSyncError("Artist name is required but not found in file or arguments")
        if not resolved_title:
            raise MusicSyncError("Song title is required but not found in file or arguments")

        if is_album_song and not resolved_album:
            raise MusicSyncError("Album name required for album songs but not found in file or arguments")

        track_number = None
        if "tracknumber" in id3_info and id3_info["tracknumber"]:
            track_number = self._normalize_track_number(id3_info["tracknumber"][0])

        if is_album_song and not track_number:
            raise MusicSyncError("Track number required for album songs but not found in file")

        if resolved_album:
            resolved_album = self._sanitize_filename(resolved_album)

        return SongMetadata(
            artist=resolved_artist,
            title=resolved_title,
            album_name=resolved_album,
            track_number=track_number
        )

    def _verify_song_in_db(
        self,
        metadata: SongMetadata,
        song_uuid: str | None,
        is_album_song: bool
    ) -> QuerySet:
        """Ensure the song exists uniquely in the database.

        Verifies that exactly one song matches the provided criteria in the database.
        Uses UUID for direct lookup if provided, otherwise searches by artist/title/album.

        Args:
            metadata: Song metadata for database lookup.
            song_uuid: Optional UUID for direct database lookup.
            is_album_song: Whether to include album in the search criteria.

        Returns:
            QuerySet containing the single matching song.

        Raises:
            MusicSyncError: If no song found or multiple songs match the criteria.
        """
        if song_uuid:
            song_qs = Song.objects.filter(uuid=song_uuid)
        else:
            song_qs = Song.objects.filter(
                title=metadata.title,
                artist__name=metadata.artist
            )

        if is_album_song and metadata.album_name:
            song_qs = song_qs.filter(album__title=metadata.album_name)

        count = song_qs.count()
        if count == 0:
            raise MusicSyncError(
                f"Song not found in database: artist='{metadata.artist}', title='{metadata.title}'"
            )
        if count > 1:
            raise MusicSyncError(
                f"Multiple songs found in database: artist='{metadata.artist}', title='{metadata.title}'"
            )

        song_obj = song_qs.first()
        if song_obj is None:
            # Shouldn't happen because we just checked count()==1, but guard for races.
            raise MusicSyncError("Song vanished during verification; re-run sync.")

        self.stdout.write(f"{Fore.GREEN}Song found in database, uuid={song_obj.uuid}{Style.RESET_ALL}")
        return song_qs
