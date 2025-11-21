import uuid
from typing import List

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


def drill_intervals_default() -> List[int]:
    """Return the default list of drill intervals.

    This function is used as a callable default for the ArrayField to avoid
    using a mutable object (like a list) directly. Using a function ensures
    that a new list is created for each model instance, preventing unintended
    shared state between instances.

    Returns:
        List[int]: A list of default interval values.
    """
    return INTERVALS_DEFAULT


class UserProfile(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.PROTECT)
    pinned_tags = models.ManyToManyField(Tag, through="UserTag")
    pinned_notes = models.ManyToManyField(Blob, through="UserNote")
    feeds = models.ManyToManyField(Feed, through="UserFeed")
    pinned_drill_tags = models.ManyToManyField(Tag, through="DrillTag", related_name="pinned_drill_tags")
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

    def get_tags(self):
        return ", ".join([tag.name for tag in self.pinned_tags.all().order_by("usertag__sort_order")])

    def __str__(self):
        return self.user.username


class UserTag(SortOrderMixin):

    userprofile = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)

    field_name = "userprofile"

    class Meta:
        ordering = ("sort_order",)
        unique_together = (
            ("userprofile", "tag")
        )


@receiver(pre_delete, sender=UserTag)
def remove_tag(sender, instance, **kwargs):
    instance.handle_delete()


class UserNote(SortOrderMixin):

    userprofile = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    blob = models.ForeignKey(Blob, on_delete=models.CASCADE)

    field_name = "userprofile"

    class Meta:
        ordering = ("sort_order",)
        unique_together = (
            ("userprofile", "blob")
        )


class UserFeed(SortOrderMixin):

    userprofile = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    feed = models.ForeignKey(Feed, on_delete=models.CASCADE)

    field_name = "userprofile"

    def __str__(self):
        return f"SortOrder: {self.userprofile}, {self.feed}"

    class Meta:
        ordering = ("sort_order",)
        unique_together = (
            ("userprofile", "feed")
        )


@receiver(pre_delete, sender=UserFeed)
def remove_feed(sender, instance, **kwargs):
    instance.handle_delete()


class DrillTag(SortOrderMixin):

    userprofile = models.ForeignKey("accounts.UserProfile", on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)

    field_name = "userprofile"

    class Meta:
        ordering = ("sort_order",)
        unique_together = (
            ("userprofile", "tag")
        )


@receiver(pre_delete, sender=DrillTag)
def remove_tag_for_drill(sender, instance, **kwargs):
    instance.handle_delete()


@receiver(pre_delete, sender=UserNote)
def remove_note(sender, instance, **kwargs):
    instance.handle_delete()


def create_user_profile(sender, instance, created, **kwargs):
    if created:
        p = UserProfile()
        p.user = instance
        p.save()


post_save.connect(create_user_profile, sender=User)
