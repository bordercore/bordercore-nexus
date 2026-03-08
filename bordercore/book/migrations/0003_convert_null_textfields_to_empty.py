"""Data migration: convert NULL text fields to empty strings."""

from django.db import migrations


def convert_nulls_to_empty(apps, schema_editor):
    Book = apps.get_model("book", "Book")
    Book.objects.filter(subtitle__isnull=True).update(subtitle="")
    Book.objects.filter(isbn__isnull=True).update(isbn="")
    Book.objects.filter(asin__isnull=True).update(asin="")
    Book.objects.filter(publisher__isnull=True).update(publisher="")
    Book.objects.filter(notes__isnull=True).update(notes="")


class Migration(migrations.Migration):

    dependencies = [
        ("book", "0002_book_user"),
    ]

    operations = [
        migrations.RunPython(convert_nulls_to_empty, migrations.RunPython.noop),
    ]
