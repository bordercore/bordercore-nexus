"""Data migration: repair PlaylistItem sort_order gaps left by Song deduplication.

Migration 0012 deleted duplicate Songs, which cascade-deleted PlaylistItems
without adjusting sort_order (pre_delete signals don't fire for historical
models in data migrations). This migration reassigns dense 1-based sort_order
sequences per playlist.
"""

from django.db import migrations


def fix_sort_order(apps, schema_editor):
    PlaylistItem = apps.get_model("music", "PlaylistItem")

    playlist_ids = (
        PlaylistItem.objects
        .values_list("playlist_id", flat=True)
        .distinct()
    )

    for playlist_id in playlist_ids:
        items = list(
            PlaylistItem.objects
            .filter(playlist_id=playlist_id)
            .order_by("sort_order", "pk")
            .values_list("pk", flat=True)
        )
        for i, pk in enumerate(items, start=1):
            PlaylistItem.objects.filter(pk=pk).update(sort_order=i)


class Migration(migrations.Migration):

    dependencies = [
        ("music", "0014_alter_album_compilation_and_more"),
    ]

    operations = [
        migrations.RunPython(fix_sort_order, migrations.RunPython.noop),
    ]
