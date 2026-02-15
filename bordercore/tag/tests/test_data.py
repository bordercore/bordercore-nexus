import pytest

from django.db.models import OuterRef, Q, Subquery

from bookmark.models import Bookmark
from tag.models import Tag, TagAlias, TagBookmark

pytestmark = [pytest.mark.django_db, pytest.mark.data_quality]


def test_tagbookmark_exists():
    """
    Every bookmark with a tag must have a representative TagBookmark object.
    """

    bookmarks = Bookmark.objects.filter(tags__isnull=False, tagbookmark__isnull=True)

    assert len(bookmarks) == 0, f"Tagged bookmark isn't present in TagBookmark, bookmark_id={bookmarks.first().id}, tag={bookmarks.first().tags.first()}"


def test_tagbookmark_and_tag_exists():
    """
    For every TagBookmark object, the corresponding bookmark must also
    have the corresponding tag.
    """

    tagbookmarks = TagBookmark.objects.exclude(
        tag__in=Subquery(
            Bookmark.objects.filter(
                pk=OuterRef("bookmark")
            ).values(
                "tags"
            )
        )
    )

    assert len(tagbookmarks) == 0, f"TagBookmark id={tagbookmarks.first().pk} exists, but bookmark id={tagbookmarks.first().bookmark.id} does not have tag id={tagbookmarks.first().tag.id} ({tagbookmarks.first().tag})"


def test_tag_alias():
    """
    There should be no tags that match any tag aliases.
    """
    # Get all alias (user, name) pairs
    alias_pairs = TagAlias.objects.values_list("user", "name")

    # Check if any tags exist with those combinations
    conflicting_tags = Tag.objects.filter(
        Q(*[Q(user=user, name=name) for user, name in alias_pairs], _connector="OR")
    ).values_list("user", "name")

    assert not conflicting_tags.exists(), \
        f"Tags exist that conflict with aliases: {list(conflicting_tags)}"
