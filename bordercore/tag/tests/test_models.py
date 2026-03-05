import pytest
from faker import Factory as FakerFactory

from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError

from tag.models import Tag, TagAlias, TagBookmark, TagHabit, TagTodo
from tag.tests.factories import TagFactory

pytestmark = [pytest.mark.django_db]

faker = FakerFactory.create()


def test_tag_check_no_commas_constraint(authenticated_client):
    """
    Test the constraint that prohibits tags with commas in their name
    """

    user, _ = authenticated_client()

    with pytest.raises(IntegrityError):
        Tag.objects.create(user=user, name="tag,name")


def test_tag_check_name_is_lowercase(authenticated_client):
    """
    Test the constraint that prohibits tags with uppercase characters
    """

    user, _ = authenticated_client()
    with pytest.raises(IntegrityError):
        Tag.objects.create(user=user, name="Tagname")


def test_tag_check_tag_alias(authenticated_client):
    """
    Test that there exists no tag with the same name as a tag alias
    """

    user, _ = authenticated_client()

    tag_1 = TagFactory(user=user, name=faker.text(max_nb_chars=16).lower())
    alias = TagAlias.objects.create(user=user, tag=tag_1, name=faker.text(max_nb_chars=16).lower())

    with pytest.raises(ValidationError):
        TagFactory(user=user, name=alias.name)


def test_reorder(bookmark, tag):

    # Move the first bookmark down the list, from 1 -> 2
    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[0])
    tbso.reorder(2)
    assert tbso.sort_order == 2

    # Verify that the other two bookmarks have changed their sort order
    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[1])
    assert tbso.sort_order == 1

    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[2])
    assert tbso.sort_order == 3

    # Move the same bookmark down the list again, from 2 -> 3
    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[0])
    tbso.reorder(3)
    assert tbso.sort_order == 3

    # Verify that the other two bookmarks have changed their sort order
    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[1])
    assert tbso.sort_order == 1

    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[2])
    assert tbso.sort_order == 2

    # Move the same bookmark back to the top of the list
    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[0])
    tbso.reorder(1)
    assert tbso.sort_order == 1

    # Verify that the other two bookmarks have changed their sort order
    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[1])
    assert tbso.sort_order == 2

    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[2])
    assert tbso.sort_order == 3

    # Move the last bookmark to the top of the list
    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[2])
    tbso.reorder(1)
    assert tbso.sort_order == 1

    # Verify that the other two bookmarks have changed their sort order
    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[0])
    assert tbso.sort_order == 2

    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[1])
    assert tbso.sort_order == 3


def test_delete(bookmark, tag):

    # Delete the first bookmark
    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[0])
    tbso.delete()

    # Verify that the last two bookmarks have a new sort order (decrease by one)
    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[1])
    assert tbso.sort_order == 1

    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[2])
    assert tbso.sort_order == 2

    # Delete the new first bookmark
    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[1])
    tbso.delete()

    # Verify that the last bookmark has sort_order = 1
    tbso = TagBookmark.objects.get(tag=tag[0], bookmark=bookmark[2])
    assert tbso.sort_order == 1


def test_pin(authenticated_client, tag):

    user, _ = authenticated_client()

    tag[0].pin()

    assert tag[0] in user.userprofile.pinned_tags.all()


def test_unpin(authenticated_client, tag):

    user, _ = authenticated_client()

    tag[0].pin()
    tag[0].unpin()

    assert tag[0] not in user.userprofile.pinned_tags.all()


def test_tag_unique_together(authenticated_client):
    """Tag name must be unique per user."""

    user, _ = authenticated_client()

    Tag.objects.create(user=user, name="unique-tag")

    with pytest.raises(IntegrityError):
        Tag.objects.create(user=user, name="unique-tag")


def test_tag_str(tag):
    assert str(tag[0]) == tag[0].name


def test_get_meta_tags(authenticated_client, tag):
    """get_meta_tags returns names of tags where is_meta=True."""

    user, _ = authenticated_client()

    # tag[1] ("video") is created with is_meta=True in _seed_data,
    # but get_meta_tags also requires blob__user=user, so create a blob.
    from blob.tests.factories import BlobFactory
    blob = BlobFactory(user=user)
    blob.tags.add(tag[1])

    meta_tags = Tag.get_meta_tags(user)
    assert "video" in meta_tags
    assert "django" not in meta_tags


def test_get_related_counts(authenticated_client, tag):
    """get_related_counts returns annotated counts for a tag."""

    user, _ = authenticated_client()

    result = tag[0].get_related_counts().first()
    assert result is not None
    assert "name" in result
    assert "bookmark__count" in result
    assert "todo__count" in result


def test_tag_todo_sort_order(todo):
    """TagTodo entries maintain sort order on create and delete."""

    # The `todo` fixture adds task_3 to tag_0 and tag_1.
    # Get the tags from the todo's own tag set.
    todo_tag = todo.tags.first()
    entries = TagTodo.objects.filter(tag=todo_tag)
    assert entries.exists()

    # Deleting a TagTodo adjusts remaining sort orders
    first = entries.order_by("sort_order").first()
    first_order = first.sort_order
    first.delete()

    remaining = TagTodo.objects.filter(tag=todo_tag).order_by("sort_order")
    if remaining.exists():
        assert remaining.first().sort_order <= first_order


def test_tag_habit_sort_order(habit):
    """TagHabit entries are created with sort order."""

    habit_tag = habit.tags.first()
    entries = TagHabit.objects.filter(tag=habit_tag)
    assert entries.exists()

    # Verify sort_order is set
    for entry in entries:
        assert entry.sort_order >= 1


def test_tag_habit_delete_adjusts_sort_order(authenticated_client):
    """Deleting a TagHabit adjusts sort order for remaining entries."""

    user, _ = authenticated_client()

    from habit.tests.factories import HabitFactory
    tag = TagFactory(user=user, name="habit-sort-test")
    h1 = HabitFactory(user=user)
    h2 = HabitFactory(user=user)
    h3 = HabitFactory(user=user)

    h1.tags.add(tag)
    h2.tags.add(tag)
    h3.tags.add(tag)

    entries = TagHabit.objects.filter(tag=tag).order_by("sort_order")
    assert entries.count() == 3

    # Delete the first entry
    entries.first().delete()

    remaining = TagHabit.objects.filter(tag=tag).order_by("sort_order")
    assert remaining.count() == 2
    assert remaining[0].sort_order == 1
    assert remaining[1].sort_order == 2


def test_tag_alias_unique_name(authenticated_client):
    """TagAlias name must be globally unique."""

    user, _ = authenticated_client()

    tag1 = TagFactory(user=user, name="alias-test-1")
    tag2 = TagFactory(user=user, name="alias-test-2")

    TagAlias.objects.create(user=user, tag=tag1, name="shared-alias")

    with pytest.raises(IntegrityError):
        TagAlias.objects.create(user=user, tag=tag2, name="shared-alias")


def test_tag_alias_str(authenticated_client):

    user, _ = authenticated_client()

    tag = TagFactory(user=user, name="alias-str-test")
    alias = TagAlias.objects.create(user=user, tag=tag, name="my alias")

    assert str(alias) == "my alias"
