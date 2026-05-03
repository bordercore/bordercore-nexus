from django.db import migrations
from django.db.models import Count, F, Max


def backfill_and_dedup(apps, schema_editor):
    """Backfill pub_date for existing rows and remove duplicate (feed, link) pairs.

    Existing FeedItems have no pub_date; we set it to ``created`` so ordering
    works uniformly until the next refresh upserts a real publication date.

    The new ``unique_together`` constraint added in 0008 would fail if any
    duplicate (feed, link) rows exist. Today's nuke-and-pave workflow makes
    duplicates unlikely, but defensive cleanup is cheap.
    """
    FeedItem = apps.get_model("feed", "FeedItem")
    FeedItem.objects.filter(pub_date__isnull=True).update(pub_date=F("created"))

    duplicates = (
        FeedItem.objects.values("feed_id", "link")
        .annotate(n=Count("id"), keeper=Max("id"))
        .filter(n__gt=1)
    )
    for dup in duplicates:
        (FeedItem.objects
         .filter(feed_id=dup["feed_id"], link=dup["link"])
         .exclude(id=dup["keeper"])
         .delete())


def noop(apps, schema_editor):
    """Reverse: backfilled values stay; dedup is irreversible."""


class Migration(migrations.Migration):

    dependencies = [
        ("feed", "0006_add_pub_date_and_user_state"),
    ]

    operations = [
        migrations.RunPython(backfill_and_dedup, noop),
    ]
