"""Data migration: remove duplicate songs before adding uniqueness constraint."""

from django.db import migrations
from django.db.models import Count, Max


def deduplicate_songs(apps, schema_editor):
    Song = apps.get_model("music", "Song")

    dupes = (
        Song.objects
        .values("title", "artist", "album", "user")
        .annotate(cnt=Count("id"), keep_id=Max("times_played"))
        .filter(cnt__gt=1)
    )

    for d in dupes:
        songs = Song.objects.filter(
            title=d["title"], artist=d["artist"], album=d["album"], user=d["user"],
        ).order_by("-times_played", "created")
        # Keep the first (most played / earliest), delete the rest
        keep = songs.first()
        songs.exclude(pk=keep.pk).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("music", "0011_alter_song_options"),
    ]

    operations = [
        migrations.RunPython(deduplicate_songs, migrations.RunPython.noop),
    ]
