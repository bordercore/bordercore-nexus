"""Models for user profiles and user-specific preferences.

This module defines models to represent user profiles with various preferences
and settings, including pinned tags, notes, feeds, drill intervals, theme
settings, and integrations with external services (Google Calendar, Instagram,
weather, etc.). It also includes through-models for managing sortable
relationships between users and tags, notes, and feeds.
"""
import uuid
from typing import Any

from feed.models import Feed

from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models import JSONField
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from blob.models import Blob
from collection.models import Collection
from drill.models import INTERVALS_DEFAULT
from lib.mixins import SortOrderMixin
from tag.models import Tag


def drill_intervals_default() -> list[int]:
    """Return the default list of drill intervals.

    This function is used as a callable default for the ArrayField to avoid
    using a mutable object (like a list) directly. Using a function ensures
    that a new list is created for each model instance, preventing unintended
    shared state between instances.

    Returns:
        list[int]: A list of default interval values.
    """
    return INTERVALS_DEFAULT


class UserProfile(models.Model):
    """A user profile with preferences, settings, and integrations.

    Extends the Django User model with additional user-specific settings
    including pinned tags and notes, feed subscriptions, drill intervals,
    theme preferences, and various third-party service integrations.
    """

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.PROTECT)
    pinned_tags: models.ManyToManyField = models.ManyToManyField(Tag, through="UserTag")
    pinned_notes: models.ManyToManyField = models.ManyToManyField(Blob, through="UserNote")
    feeds: models.ManyToManyField = models.ManyToManyField(Feed, through="UserFeed")
    pinned_drill_tags: models.ManyToManyField = models.ManyToManyField(Tag, through="DrillTag", related_name="pinned_drill_tags")
    google_calendar = JSONField(blank=True, null=True)
    google_calendar_email = models.EmailField(blank=True, null=True)
    instagram_credentials = JSONField(blank=True, null=True)
    nytimes_api_key = models.TextField(null=True)
    homepage_default_collection = models.OneToOneField(Collection, related_name="default_collection", null=True, on_delete=models.PROTECT)
    homepage_image_collection = models.OneToOneField(Collection, related_name="image_collection", null=True, on_delete=models.PROTECT)
    sidebar_image = models.TextField(blank=True, null=True)
    background_image = models.TextField(blank=True, null=True)
    drill_intervals = ArrayField(models.IntegerField(), default=drill_intervals_default)
    eye_candy = models.BooleanField(default=False)
    drill_tags_muted = models.ManyToManyField(Tag, related_name="drill_tags_muted")

    THEMES = [
        ("light", "light"),
        ("dark", "dark"),
        ("purple", "purple"),
    ]

    theme = models.CharField(
        max_length=20,
        choices=THEMES,
        default="light",
    )

    def get_tags(self) -> str:
        """Return a comma-separated string of pinned tag names.

        Tags are ordered by their sort order as defined in the UserTag
        through-model.

        Returns:
            str: Comma-separated tag names.
        """
        return ", ".join([tag.name for tag in self.pinned_tags.all().order_by("usertag__sort_order")])

    def __str__(self) -> str:
        """Return string representation of the user profile."""
        return self.user.username


class UserTag(SortOrderMixin):
    """Through-model linking a UserProfile to a Tag with sort ordering."""

    userprofile = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)

    field_name = "userprofile"

    class Meta:
        ordering = ("sort_order",)
        unique_together = (
            ("userprofile", "tag")
        )


@receiver(pre_delete, sender=UserTag)
def remove_tag(sender: type[UserTag], instance: UserTag, **kwargs: Any) -> None:
    """Handle deletion of a UserTag instance.

    Ensures proper cleanup of sort order when a UserTag is deleted.

    Args:
        sender: The model class (UserTag).
        instance: The UserTag instance being deleted.
        **kwargs: Additional keyword arguments.
    """
    instance.handle_delete()


class UserNote(SortOrderMixin):
    """Through-model linking a UserProfile to a Blob (note) with sort ordering."""

    userprofile = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    blob = models.ForeignKey(Blob, on_delete=models.CASCADE)

    field_name = "userprofile"

    class Meta:
        ordering = ("sort_order",)
        unique_together = (
            ("userprofile", "blob")
        )


class UserFeed(SortOrderMixin):
    """Through-model linking a UserProfile to a Feed with sort ordering."""

    userprofile = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    feed = models.ForeignKey(Feed, on_delete=models.CASCADE)

    field_name = "userprofile"

    def __str__(self) -> str:
        """Return string representation of the user feed."""
        return f"SortOrder: {self.userprofile}, {self.feed}"

    class Meta:
        ordering = ("sort_order",)
        unique_together = (
            ("userprofile", "feed")
        )


@receiver(pre_delete, sender=UserFeed)
def remove_feed(sender: type[UserFeed], instance: UserFeed, **kwargs: Any) -> None:
    """Handle deletion of a UserFeed instance.

    Ensures proper cleanup of sort order when a UserFeed is deleted.

    Args:
        sender: The model class (UserFeed).
        instance: The UserFeed instance being deleted.
        **kwargs: Additional keyword arguments.
    """
    instance.handle_delete()


class DrillTag(SortOrderMixin):
    """Through-model linking a UserProfile to a Tag for drill functionality with sort ordering."""

    userprofile = models.ForeignKey("accounts.UserProfile", on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)

    field_name = "userprofile"

    class Meta:
        ordering = ("sort_order",)
        unique_together = (
            ("userprofile", "tag")
        )


@receiver(pre_delete, sender=DrillTag)
def remove_tag_for_drill(sender: type[DrillTag], instance: DrillTag, **kwargs: Any) -> None:
    """Handle deletion of a DrillTag instance.

    Ensures proper cleanup of sort order when a DrillTag is deleted.

    Args:
        sender: The model class (DrillTag).
        instance: The DrillTag instance being deleted.
        **kwargs: Additional keyword arguments.
    """
    instance.handle_delete()


@receiver(pre_delete, sender=UserNote)
def remove_note(sender: type[UserNote], instance: UserNote, **kwargs: Any) -> None:
    """Handle deletion of a UserNote instance.

    Ensures proper cleanup of sort order when a UserNote is deleted.

    Args:
        sender: The model class (UserNote).
        instance: The UserNote instance being deleted.
        **kwargs: Additional keyword arguments.
    """
    instance.handle_delete()


def create_user_profile(sender: type[User], instance: User, created: bool, **kwargs: Any) -> None:
    """Create a UserProfile when a new User is created.

    This signal handler automatically creates a UserProfile instance
    whenever a new Django User is created, ensuring every user has
    an associated profile.

    Args:
        sender: The model class (User).
        instance: The User instance that was saved.
        created: Boolean indicating if this is a new instance.
        **kwargs: Additional keyword arguments.
    """
    if created:
        p = UserProfile()
        p.user = instance
        p.save()


post_save.connect(create_user_profile, sender=User)
