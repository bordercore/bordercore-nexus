import pytest
from faker import Factory as FakerFactory

from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError

from tag.models import Tag, TagAlias, TagBookmark
from tag.tests.factories import TagFactory

pytestmark = pytest.mark.django_db

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
