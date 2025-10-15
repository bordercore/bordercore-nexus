"""
Models for RSS/Atom feed aggregation. This module defines two models:

- Feed: Represents an RSS/Atom feed a user follows and provides a method to
  fetch and refresh its items from the network.
- FeedItem: Individual entries (title/link) parsed from a feed.
"""
from __future__ import annotations

import html
import logging
import uuid
from typing import Any, Dict, List, MutableMapping, TypedDict

import feedparser
import requests

from django.contrib.auth.models import User
from django.contrib.sessions.backends.base import SessionBase
from django.db import models, transaction
from django.utils import timezone

from lib.mixins import TimeStampedModel

USER_AGENT: str = "Bordercore/1.0"

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
        """Fetch the feed from the network and refresh its items.

        This method performs an HTTP GET to retrieve the feed XML, parses it
        via `feedparser`, deletes existing `FeedItem`s for this feed, and then
        recreates them from the parsed entries.

        Returns:
            The number of entries parsed and stored.

        Raises:
            requests.HTTPError: If the HTTP response status is not 200.
        """
        r: requests.Response | None = None
        feed_list: List[Any] = []

        try:
            headers: Dict[str, str] = {"user-agent": USER_AGENT}
            r = requests.get(self.url, headers=headers, verify=self.verify_ssl_certificate, timeout=10)

            if r.status_code != 200:
                r.raise_for_status()

            parsed = feedparser.parse(r.text)
            # `entries` is a list-like structure of feed entries with attributes.
            feed_list = list(parsed.entries)

            with transaction.atomic():
                # Nuke-and-pave: replace items with the freshly parsed set.
                FeedItem.objects.filter(feed_id=self.pk).delete()
                items = []

                for entry in feed_list:
                    try:
                        # entry.title/link may not exist on malformed items.
                        title_raw = getattr(entry, "title", "") or "No Title"
                        link_raw = getattr(entry, "link", "") or ""
                        title_clean = html.unescape(html.unescape(title_raw.replace("\n", "")))
                        link_clean = html.unescape(link_raw)
                        items.append(FeedItem(feed=self, title=title_clean, link=link_clean))
                    except AttributeError as e:
                        log.error("feed_uuid=%s Missing data in feed item: %s", self.uuid, e)

                FeedItem.objects.bulk_create(items, batch_size=500)

        finally:
            # Record status/attempt time regardless of success/failure.
            if r is not None:
                self.last_response_code = r.status_code
            self.last_check = timezone.now()
            self.save()

        return len(feed_list)

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

    def __str__(self) -> str:
        """Return the display title of the feed item.

        Returns:
            The item title.
        """
        return self.title
