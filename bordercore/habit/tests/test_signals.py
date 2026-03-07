from datetime import date

import pytest

from accounts.tests.factories import UserFactory
from habit.tests.factories import HabitFactory
from tag.models import Tag, TagHabit

pytestmark = [pytest.mark.django_db]


def test_tags_changed_post_add_creates_tag_habit():
    """Test that adding a tag to a habit creates a TagHabit relation."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())
    tag = Tag.objects.create(name="exercise", user=user)

    habit.tags.add(tag)

    assert TagHabit.objects.filter(tag=tag, habit=habit).exists()


def test_tags_changed_post_add_idempotent():
    """Test that adding the same tag twice doesn't create duplicate TagHabit."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())
    tag = Tag.objects.create(name="exercise", user=user)

    habit.tags.add(tag)
    habit.tags.add(tag)

    assert TagHabit.objects.filter(tag=tag, habit=habit).count() == 1


def test_tags_changed_post_remove_deletes_tag_habit():
    """Test that removing a tag from a habit deletes the TagHabit relation."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())
    tag = Tag.objects.create(name="exercise", user=user)

    habit.tags.add(tag)
    assert TagHabit.objects.filter(tag=tag, habit=habit).exists()

    habit.tags.remove(tag)
    assert not TagHabit.objects.filter(tag=tag, habit=habit).exists()


def test_tags_changed_multiple_tags():
    """Test adding and removing multiple tags."""
    user = UserFactory()
    habit = HabitFactory(user=user, start_date=date.today())
    tag1 = Tag.objects.create(name="morning", user=user)
    tag2 = Tag.objects.create(name="health", user=user)

    habit.tags.add(tag1, tag2)
    assert TagHabit.objects.filter(habit=habit).count() == 2

    habit.tags.remove(tag1)
    assert TagHabit.objects.filter(habit=habit).count() == 1
    assert TagHabit.objects.filter(tag=tag2, habit=habit).exists()
