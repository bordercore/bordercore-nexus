"""Data migration: convert NULL text fields to empty strings."""

from django.db import migrations


def convert_nulls_to_empty(apps, schema_editor):
    Blob = apps.get_model("blob", "Blob")
    Blob.objects.filter(content__isnull=True).update(content="")
    Blob.objects.filter(name__isnull=True).update(name="")
    Blob.objects.filter(note__isnull=True).update(note="")
    Blob.objects.filter(date__isnull=True).update(date="")


class Migration(migrations.Migration):

    dependencies = [
        ("blob", "0036_blob_blob_blob_user_id_ec3990_idx_and_more"),
    ]

    operations = [
        migrations.RunPython(convert_nulls_to_empty, migrations.RunPython.noop),
    ]
