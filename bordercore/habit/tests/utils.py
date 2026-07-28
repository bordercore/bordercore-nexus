"""Shared test helpers for the Habit app."""

from datetime import datetime, time

from django.utils import timezone

from habit.models import HabitNote


def set_note_clock_time(note: HabitNote, hour: int, minute: int = 0) -> None:
    """Pin a note's `created` to a specific local time on the note's own date.

    Intra-day note ordering and the serialized `time` field both key off
    `created`, so tests need it to be deterministic rather than dependent on
    insert timing.  `created` is auto_now_add, which a save() would re-stamp;
    QuerySet.update() bypasses that.
    """
    stamp = timezone.make_aware(datetime.combine(note.date, time(hour, minute)))
    HabitNote.objects.filter(pk=note.pk).update(created=stamp)


def set_note_created(note: HabitNote, moment: datetime) -> None:
    """Pin a note's `created` to an explicit aware datetime.

    Used to build the "written about an earlier day" case, where `created`
    falls on a different date than the note itself.
    """
    HabitNote.objects.filter(pk=note.pk).update(created=moment)
