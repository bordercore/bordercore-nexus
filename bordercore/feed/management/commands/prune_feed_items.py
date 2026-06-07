"""
Management command to prune old feed items.

Feeds accumulate items indefinitely, but the reader only needs a recent
rolling window. This deletes FeedItem rows whose ``created`` timestamp is
older than the retention window (default 30 days), in batches to bound the
lock and memory footprint of a large delete. Deletions cascade to
UserFeedItemState via the model's ``on_delete=CASCADE``, so per-user read
state for the removed items is cleaned up automatically.

Pruning keys off ``created`` (the ingestion time, set once on insert and left
untouched by the upsert in Feed.update) rather than ``pub_date``, which feeds
frequently report inaccurately — dates years in the past or future — and which
would otherwise delete items the moment they were fetched.

Usage:
    python manage.py prune_feed_items
    python manage.py prune_feed_items --days 60
    python manage.py prune_feed_items --dry-run

Options:
    --days: Retention window in days (default 30). Items created before this
        many days ago are deleted.
    --batch-size: Number of items to delete per batch (default 1000).
    --dry-run: Report how many items would be deleted without deleting them.
    --verbosity: 0 silences output, 2+ prints per-batch progress.
"""

import logging
from argparse import ArgumentParser
from datetime import timedelta
from typing import Any

from feed.models import FeedItem

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

logger = logging.getLogger(__name__)

DEFAULT_RETENTION_DAYS = 30
DEFAULT_BATCH_SIZE = 1000


class Command(BaseCommand):
    """Delete feed items older than a retention window."""

    help = "Delete feed items older than the retention window (default 30 days)"

    def add_arguments(self, parser: ArgumentParser) -> None:
        """Add command-line arguments."""
        parser.add_argument(
            "--days",
            type=int,
            default=DEFAULT_RETENTION_DAYS,
            help=f"Retention window in days (default {DEFAULT_RETENTION_DAYS}). "
                 "Items created before this many days ago are deleted.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=DEFAULT_BATCH_SIZE,
            help=f"Number of items to delete per batch (default {DEFAULT_BATCH_SIZE}).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            dest="dry_run",
            help="Report how many items would be deleted without deleting them.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        """Handle command execution."""
        days: int = options["days"]
        batch_size: int = options["batch_size"]
        dry_run: bool = options["dry_run"]
        verbosity = int(options.get("verbosity", 1))

        if days < 1:
            raise CommandError("--days must be a positive integer")
        if batch_size < 1:
            raise CommandError("--batch-size must be a positive integer")

        cutoff = timezone.now() - timedelta(days=days)
        total = FeedItem.objects.filter(created__lt=cutoff).count()

        if total == 0:
            if verbosity >= 1:
                self.stdout.write(f"No feed items older than {days} days; nothing to prune.")
            return

        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"DRY-RUN: would delete {total} feed item(s) created before "
                f"{cutoff:%Y-%m-%d %H:%M:%S %Z}"
            ))
            return

        deleted = 0
        # Delete by primary key in bounded batches. Re-querying the cutoff each
        # round (rather than paginating with an offset) keeps the window anchored
        # as rows disappear, so we never skip items.
        while True:
            batch_ids = list(
                FeedItem.objects
                .filter(created__lt=cutoff)
                .order_by("id")
                .values_list("id", flat=True)[:batch_size]
            )
            if not batch_ids:
                break
            FeedItem.objects.filter(id__in=batch_ids).delete()
            deleted += len(batch_ids)
            if verbosity >= 2:
                self.stdout.write(f"  deleted {deleted}/{total} ...")

        logger.info(
            "prune_feed_items deleted %d feed items older than %d days", deleted, days
        )
        if verbosity >= 1:
            self.stdout.write(self.style.SUCCESS(
                f"Pruned {deleted} feed item(s) older than {days} days."
            ))
