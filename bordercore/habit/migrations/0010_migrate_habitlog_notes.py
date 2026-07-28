"""Move HabitLog.note into HabitNote rows, then drop the column.

The copy and the column drop live in a single migration on purpose: split
across two, a partial deploy could leave the column dropped with the data
never copied.
"""

from django.db import migrations, models


def copy_notes_to_habitnote(apps, schema_editor):
    """Create one HabitNote per HabitLog that carries note text.

    `created` is auto_now_add, so the insert stamps it with "now" and a
    follow-up UPDATE backdates it to the log's own timestamp -- QuerySet
    .update() skips the auto_now_add machinery that save() would re-apply.
    Preserving `created` matters because it drives note ordering and the
    displayed clock time.
    """
    HabitLog = apps.get_model("habit", "HabitLog")
    HabitNote = apps.get_model("habit", "HabitNote")

    for log in HabitLog.objects.exclude(note="").exclude(note=None).iterator():
        note = HabitNote.objects.create(
            habit_id=log.habit_id,
            date=log.date,
            note=log.note,
        )
        HabitNote.objects.filter(pk=note.pk).update(created=log.created)


def collapse_notes_back_onto_habitlog(apps, schema_editor):
    """Fold each day's notes back into the restored HabitLog.note column.

    Lossy by nature, and irreversibly so:
      - a day's notes are joined into one blob, losing their separation
      - notes on days with no HabitLog row are dropped entirely, since there
        is nowhere to put them

    It exists so the migration is runnable in reverse during a rollback, not
    because the result round-trips.
    """
    HabitLog = apps.get_model("habit", "HabitLog")
    HabitNote = apps.get_model("habit", "HabitNote")

    by_day: dict[tuple[int, object], list[str]] = {}
    for note in HabitNote.objects.order_by("date", "created").iterator():
        by_day.setdefault((note.habit_id, note.date), []).append(note.note)

    for (habit_id, note_date), texts in by_day.items():
        HabitLog.objects.filter(habit_id=habit_id, date=note_date).update(
            note="\n\n".join(texts),
        )


class Migration(migrations.Migration):

    dependencies = [
        ("habit", "0009_habitnote"),
    ]

    operations = [
        migrations.RunPython(
            copy_notes_to_habitnote,
            collapse_notes_back_onto_habitlog,
        ),
        migrations.RemoveField(
            model_name="habitlog",
            name="note",
        ),
    ]
