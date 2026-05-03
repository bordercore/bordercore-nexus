"""
Models for RSS/Atom feed aggregation. This module defines three models:

- Feed: Represents an RSS/Atom feed a user follows and provides a method to
  fetch and refresh its items from the network.
- FeedItem: Individual entries (title/link/pub_date) parsed from a feed.
- UserFeedItemState: Per-user read state for a feed item.
"""
from __future__ import annotations

import calendar
import html
import logging
import uuid
from datetime import datetime, timezone as dt_timezone
from typing import Any, MutableMapping, TypedDict

import feedparser
import requests

from django.contrib.auth.models import User
from django.contrib.sessions.backends.base import SessionBase
from django.db import models, transaction
from django.utils import timezone
from django.utils.html import strip_tags

from lib.constants import USER_AGENT
from lib.mixins import TimeStampedModel

log: logging.Logger = logging.getLogger(f"bordercore.{__name__}")


class FeedIdRow(TypedDict):
    """Typed dictionary representing a minimal feed row.

    This type is returned by `Feed.get_first_feed()` and mirrors the
    structure of the `.values("id")` queryset call.

    Attributes:
        id (int): The primary key of the feed.
    """
    id: int


class Feed(TimeStampedModel):
    """A user-subscribed RSS/Atom feed.
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    name = models.TextField()
    url = models.URLField(unique=True)
    last_check = models.DateTimeField(null=True)
    last_response_code = models.IntegerField(null=True)
    homepage = models.URLField(null=True)
    verify_ssl_certificate = models.BooleanField(default=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT)

    def __str__(self) -> str:
        """Return the string representation of the feed.

        Returns:
            The feed name.
        """
        return self.name

    def update(self) -> int:
        """Fetch the feed from the network and upsert its items.

        This method performs an HTTP GET to retrieve the feed XML, parses it
        via `feedparser`, and upserts items by `(feed, link)`. Existing items
        keep their identity (and any associated per-user read state) so unread
        flags survive refreshes.

        Returns:
            The number of unique entries upserted.

        Raises:
            requests.HTTPError: If the HTTP response status is not 200.
        """
        r: requests.Response | None = None
        items_to_upsert: list[FeedItem] = []
        seen_links: set[str] = set()

        try:
            headers: dict[str, str] = {"user-agent": USER_AGENT}
            r = requests.get(self.url, headers=headers, verify=self.verify_ssl_certificate, timeout=10)

            if r.status_code != 200:
                r.raise_for_status()

            parsed = feedparser.parse(r.text)

            for entry in parsed.entries:
                try:
                    title_raw = getattr(entry, "title", "") or "No Title"
                    link_raw = getattr(entry, "link", "") or ""
                    title_clean = html.unescape(html.unescape(title_raw.replace("\n", "")))
                    link_clean = html.unescape(link_raw)
                    if link_clean in seen_links:
                        # Same XML can list the same link twice; bulk_create
                        # would otherwise raise CardinalityViolation on the
                        # ON CONFLICT clause within a single statement.
                        continue
                    seen_links.add(link_clean)
                    items_to_upsert.append(FeedItem(
                        feed=self,
                        title=title_clean,
                        link=link_clean,
                        pub_date=_entry_pub_date(entry),
                        summary=_entry_summary(entry),
                        thumbnail_url=_entry_thumbnail_url(entry),
                    ))
                except AttributeError as e:
                    log.error("feed_uuid=%s Missing data in feed item: %s", self.uuid, e)

            with transaction.atomic():
                FeedItem.objects.bulk_create(
                    items_to_upsert,
                    batch_size=500,
                    update_conflicts=True,
                    unique_fields=["feed", "link"],
                    update_fields=["title", "pub_date", "summary", "thumbnail_url"],
                )

        finally:
            if r is not None:
                self.last_response_code = r.status_code
            self.last_check = timezone.now()
            self.save()

        return len(items_to_upsert)

    @staticmethod
    def get_current_feed_id(user: User, session: SessionBase | MutableMapping[str, Any]) -> int:
        """Return the active feed id for a user/session, or a fallback.

        Logic:
        - If ``session['current_feed']`` exists and points to a valid feed, use it.
        - Otherwise, fall back to the first feed for the user (ordered by sort order).

        Args:
            user: Django user whose feeds we are querying.
            session: The user's session object (Django SessionBase or a dict-like).

        Returns:
            The primary key (id) of the active feed.

        Raises:
            ValueError: If the user has no feeds configured at all.
        """
        current_feed_id: int | None = session.get("current_feed")
        if not current_feed_id:
            return Feed.get_first_feed(user)["id"]

        try:
            found = Feed.objects.values("id").filter(pk=current_feed_id).first()
            if found and "id" in found:
                return found["id"]
            # If not found (e.g., deleted), fall back.
            return Feed.get_first_feed(user)["id"]
        except Exception as e:
            log.warning("Feed exception: %s", e)
            return Feed.get_first_feed(user)["id"]

    @staticmethod
    def get_first_feed(user: User) -> FeedIdRow:
        """Return the first feed (as a values dict) for the user, ordered by sort order.

        This uses the `user.userprofile.feeds` related manager and returns a single-row
        values dict containing at least the ``id`` field.

        Args:
            user: The Django user whose first feed to return.

        Returns:
            A dictionary like ``{'id': <int>}`` representing the first feed.

        Raises:
            ValueError: If the user has zero feeds configured.
        """
        result: FeedIdRow | None = (
            user.userprofile.feeds.values("id").order_by("userfeed__sort_order").first()
        )
        if result is None:
            raise ValueError("User has no feeds configured.")
        return result


class FeedItem(models.Model):
    """A single parsed entry from a :class:`Feed`.
    """

    feed = models.ForeignKey(Feed, on_delete=models.CASCADE)
    title = models.TextField()
    link = models.TextField()
    created = models.DateTimeField(auto_now_add=True)
    pub_date = models.DateTimeField(db_index=True)
    summary = models.TextField(blank=True, default="")
    thumbnail_url = models.URLField(max_length=2048, blank=True, default="")

    class Meta:
        unique_together = [("feed", "link")]

    def __str__(self) -> str:
        """Return the display title of the feed item.

        Returns:
            The item title.
        """
        return self.title


class UserFeedItemState(TimeStampedModel):
    """Per-user read state for a :class:`FeedItem`.

    A row exists only once a user has interacted with an item (read it).
    Items with no row for a given user are considered unread by that user.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="feed_item_states")
    feed_item = models.ForeignKey(FeedItem, on_delete=models.CASCADE, related_name="user_states")
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta(TimeStampedModel.Meta):
        unique_together = [("user", "feed_item")]
        indexes = [models.Index(fields=["user", "read_at"])]


def _entry_pub_date(entry: Any) -> datetime:
    """Extract the article publication date from a feedparser entry.

    Tries `published_parsed` then `updated_parsed`; falls back to ``now()``
    when neither is present (some feeds omit dates entirely).

    feedparser returns a ``time.struct_time`` in UTC; ``calendar.timegm``
    converts it to a UTC unix timestamp without local-timezone shifting.
    """
    parsed_time = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
    if parsed_time is None:
        return timezone.now()
    return datetime.fromtimestamp(calendar.timegm(parsed_time), tz=dt_timezone.utc)


def _entry_summary(entry: Any) -> str:
    """Extract a plain-text summary from a feedparser entry.

    feedparser normalizes RSS ``description`` and Atom ``summary``/``content``
    into ``entry.summary``. We strip HTML tags so the field is safe to render
    as text without a sanitizer; whitespace is collapsed to keep storage tidy.
    """
    raw = getattr(entry, "summary", "") or ""
    if not raw:
        return ""
    text = strip_tags(html.unescape(raw))
    return " ".join(text.split())


def _entry_thumbnail_url(entry: Any) -> str:
    """Extract a thumbnail URL from a feedparser entry, or an empty string.

    Looks at ``media:thumbnail`` (the most universal source — Reddit, many
    image-heavy blogs); falls back to ``media:content`` when only a full
    media object is present and it declares ``image/*`` medium.
    """
    media_thumbs = getattr(entry, "media_thumbnail", None) or []
    if media_thumbs:
        url = media_thumbs[0].get("url", "")
        if url:
            return url

    media_contents = getattr(entry, "media_content", None) or []
    for mc in media_contents:
        if mc.get("medium", "").startswith("image") or mc.get("type", "").startswith("image"):
            url = mc.get("url", "")
            if url:
                return url
    return ""
