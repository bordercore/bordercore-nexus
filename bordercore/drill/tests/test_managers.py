import pytest

from accounts.models import DrillTag
from drill.models import Question
from drill.tests.factories import QuestionFactory
from tag.tests.factories import TagFactory

pytestmark = pytest.mark.django_db


def test_tags_last_reviewed(authenticated_client):

    user, _ = authenticated_client()

    question_0 = QuestionFactory()
    tag_0 = TagFactory()
    question_0.tags.add(tag_0)
    question_0.save()
    question_0.record_response("good")

    question_1 = QuestionFactory()
    tag_1 = TagFactory()
    question_1.tags.add(tag_1)
    question_1.save()
    question_1.record_response("good")

    tags = Question.objects.tags_last_reviewed(user)
    assert len(tags) == 2
    assert tags[0] == tag_0
    assert tags[1] == tag_1


def test_total_tag_progress(authenticated_client):

    user, _ = authenticated_client()

    question_0 = QuestionFactory()
    tag_0 = TagFactory()
    question_0.tags.add(tag_0)
    question_0.save()

    question_1 = QuestionFactory()
    tag_1 = TagFactory()
    question_1.tags.add(tag_0)
    question_1.tags.add(tag_1)
    question_1.save()

    tag_progress = Question.objects.total_tag_progress(user)
    assert tag_progress["count"] == 2
    assert tag_progress["percentage"] == 0.0

    question_1.record_response("good")
    tag_progress = Question.objects.total_tag_progress(user)
    assert tag_progress["count"] == 1
    assert tag_progress["percentage"] == 50.0

    question_0.record_response("good")
    tag_progress = Question.objects.total_tag_progress(user)
    assert tag_progress["count"] == 0
    assert tag_progress["percentage"] == 100.0


def test_favorite_questions_progress(authenticated_client):

    user, _ = authenticated_client()

    question_0 = QuestionFactory()
    tag_0 = TagFactory()
    question_0.tags.add(tag_0)
    question_0.save()

    question_1 = QuestionFactory(is_favorite=True)
    tag_1 = TagFactory()
    question_1.tags.add(tag_0)
    question_1.tags.add(tag_1)
    question_1.save()

    tag_progress = Question.objects.favorite_questions_progress(user)
    assert tag_progress["count"] == 1
    assert tag_progress["percentage"] == 0.0

    question_1.record_response("good")
    tag_progress = Question.objects.total_tag_progress(user)
    assert tag_progress["count"] == 1
    assert tag_progress["percentage"] == 50.0


def test_get_random_tag(authenticated_client):

    user, _ = authenticated_client()

    question_0 = QuestionFactory()
    tag_0 = TagFactory()
    question_0.tags.add(tag_0)
    question_0.save()

    question_1 = QuestionFactory()
    tag_1 = TagFactory()
    question_1.tags.add(tag_1)
    question_1.save()

    tag_info = Question.objects.get_random_tag(user)
    assert tag_info["name"] in [x.name for x in (tag_0, tag_1)]


def test_get_pinned_tags(authenticated_client):

    user, _ = authenticated_client()

    tag_0 = TagFactory()
    so = DrillTag(userprofile=user.userprofile, tag=tag_0)
    so.save()

    tag_1 = TagFactory()
    so = DrillTag(userprofile=user.userprofile, tag=tag_1)
    so.save()

    tag_2 = TagFactory()

    pinned_tags = Question.objects.get_pinned_tags(user)
    assert tag_0.name in [x["name"] for x in pinned_tags]
    assert tag_1.name in [x["name"] for x in pinned_tags]
    assert tag_2.name not in [x["name"] for x in pinned_tags]


def test_recent_tags(authenticated_client):

    user, _ = authenticated_client()

    question_0 = QuestionFactory()
    tag_0 = TagFactory()
    question_0.tags.add(tag_0)
    question_0.save()

    question_1 = QuestionFactory()
    tag_1 = TagFactory()
    tag_2 = TagFactory()
    question_1.tags.add(tag_1)
    question_1.tags.add(tag_2)
    question_1.save()

    recent_tags = Question.objects.recent_tags()[:2]

    assert tag_1.name in [x["name"] for x in recent_tags]
    assert tag_2.name in [x["name"] for x in recent_tags]
    assert tag_0.name not in [x["name"] for x in recent_tags]
