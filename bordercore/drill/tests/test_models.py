import datetime
import uuid
from datetime import timedelta

import pytest

from django.utils import timezone

from blob.tests.factories import BlobFactory

from .factories import QuestionFactory

from drill.models import Question, QuestionToObject  # isort:skip

pytestmark = [pytest.mark.django_db]


def test_str(question):

    assert str(question[0]) == question[0].question


def test_needs_review(question):
    assert question[0].needs_review is True

    question[0].record_response("good")
    assert question[0].needs_review is False


def _test_one_interval(intervals, gi, gii, ei, eii, hi, hii, ri, rii):

    assert intervals["good"]["interval"] == datetime.timedelta(days=gi)
    assert intervals["good"]["interval_index"] == gii
    assert intervals["easy"]["interval"] == datetime.timedelta(days=ei)
    assert intervals["easy"]["interval_index"] == eii
    assert intervals["hard"]["interval"] == datetime.timedelta(days=hi)
    assert intervals["hard"]["interval_index"] == hii
    assert intervals["reset"]["interval"] == datetime.timedelta(days=ri)
    assert intervals["reset"]["interval_index"] == rii


def test_get_intervals():

    question = QuestionFactory()
    _test_one_interval(question.get_intervals(), 2, 1, 3, 2, 1, 0, 1, 0)

    question = QuestionFactory()
    question.record_response("good")
    _test_one_interval(question.get_intervals(), 3, 2, 5, 3, 1, 0, 1, 0)

    question = QuestionFactory(interval=timedelta(days=2), interval_index=1)
    question.record_response("easy")
    _test_one_interval(question.get_intervals(), 8, 4, 13, 5, 2, 1, 1, 0)

    question = QuestionFactory(interval=timedelta(days=5), interval_index=3)
    question.record_response("easy")
    question.record_response("easy")
    _test_one_interval(question.get_intervals(), 30, 7, 30, 7, 13, 5, 1, 0)

    question = QuestionFactory(interval=timedelta(days=30), interval_index=7)
    question.record_response("reset")
    _test_one_interval(question.get_intervals(), 2, 1, 3, 2, 1, 0, 1, 0)

    question = QuestionFactory(interval=timedelta(days=1), interval_index=0)
    question.record_response("good")
    question.record_response("good")
    question.record_response("good")
    question.record_response("hard")
    _test_one_interval(question.get_intervals(), 3, 2, 5, 3, 1, 0, 1, 0)

    question = QuestionFactory(interval=timedelta(days=2), interval_index=1)
    question.record_response("hard")
    _test_one_interval(question.get_intervals(), 2, 1, 3, 2, 1, 0, 1, 0)

    question = QuestionFactory(interval=timedelta(days=1), interval_index=0)
    question.record_response("hard")
    _test_one_interval(question.get_intervals(), 2, 1, 3, 2, 1, 0, 1, 0)

    question = QuestionFactory(interval=timedelta(days=21), interval_index=6)
    question.record_response("easy")
    _test_one_interval(question.get_intervals(), 30, 7, 30, 7, 13, 5, 1, 0)

    question = QuestionFactory(interval=timedelta(days=30), interval_index=7)
    question.record_response("easy")
    _test_one_interval(question.get_intervals(), 30, 7, 30, 7, 13, 5, 1, 0)


def test_get_tags(question):

    tags = question[0].get_tags()
    assert tags == "django, video" or tags == "video, django"


def test_record_response():

    question = QuestionFactory()

    question.record_response("good")
    assert question.interval == timedelta(days=2)

    question.record_response("good")
    assert question.interval == timedelta(days=3)

    question.record_response("good")
    assert question.interval == timedelta(days=5)

    question.record_response("hard")
    assert question.interval == timedelta(days=2)

    question.record_response("reset")
    assert question.interval == timedelta(days=1)

    question.record_response("reset")
    assert question.interval == timedelta(days=1)

    question.record_response("easy")
    assert question.interval == timedelta(days=3)


def test_get_last_response(question):

    question[0].record_response("easy")
    question[0].record_response("good")
    assert question[0].get_last_response().response == "good"


def test_get_all_tags_progress(question):

    tags_info = question[0].get_all_tags_progress()
    assert len(tags_info) == 2


def test_sql_db(question, blob_image_factory):

    QuestionToObject.objects.create(node=question[0], blob=blob_image_factory[0], note="sql")
    assert question[0].sql_db.blob == blob_image_factory[0]


def test_add_related_object(authenticated_client, question):

    user, _ = authenticated_client()

    # question = QuestionFactory.create(user=user)
    blob = BlobFactory.create(user=user)

    response = question[0].add_related_object(blob.uuid)
    assert response == {"status": "OK"}

    response = question[0].add_related_object(uuid.uuid4())
    assert response == {"status": "ERROR", "message": "Related Blob or Bookmark not found"}

    response = question[0].add_related_object(blob.uuid)
    assert response == {"status": "ERROR", "message": "That object is already related"}


def test_start_study_session(question, tag):

    session = {}

    current = Question.start_study_session(question[0].user, session, "favorites", "review")
    assert current in [str(question[2].uuid), str(question[3].uuid)]
    assert len(session["drill_study_session"]["list"]) == 2

    current = Question.start_study_session(question[0].user, session, "tag", "review", {"tags": tag[0].name})
    assert current in [str(x.uuid) for x in question]
    assert len(session["drill_study_session"]["list"]) == 1
    assert session["drill_study_session"]["tag"] == tag[0].name

    current = Question.start_study_session(question[0].user, session, "learning", "review")
    assert current in [str(x.uuid) for x in question]
    assert len(session["drill_study_session"]["list"]) == 4

    current = Question.start_study_session(question[0].user, session, "random", "review", {"count": 3})
    assert current in [str(x.uuid) for x in question]
    assert len(session["drill_study_session"]["list"]) == 3

    first_word_of_question = question[0].question.split(" ")[0]
    current = Question.start_study_session(question[0].user, session, "keyword", "review", {"keyword": first_word_of_question})
    assert current in [str(x.uuid) for x in question]
    assert len(session["drill_study_session"]["list"]) >= 1
    first_word_of_answer = question[0].answer.split(" ")[0]
    current = Question.start_study_session(question[0].user, session, "keyword", "review", {"keyword": first_word_of_answer})
    assert current in [str(x.uuid) for x in question]
    assert len(session["drill_study_session"]["list"]) >= 1


def test_get_tag_progress(question, tag):

    tags_info = Question.get_tag_progress(question[0].user, tag[0])
    assert str(tags_info["name"]) == "django"
    assert tags_info["progress"] == 0
    assert tags_info["last_reviewed"] == "Never"
    assert tags_info["count"] == 1

    question[0].record_response("good")

    tags_info = Question.get_tag_progress(question[0].user, tag[0])
    assert str(tags_info["name"]) == "django"
    assert tags_info["progress"] == 100
    assert tags_info["last_reviewed"] == timezone.now().strftime("%B %d, %Y")
    assert tags_info["count"] == 1

    question[0].record_response("good")

    tags_info = Question.get_tag_progress(question[0].user, tag[0])
    assert str(tags_info["name"]) == "django"
    assert tags_info["progress"] == 100
    assert tags_info["last_reviewed"] == timezone.now().strftime("%B %d, %Y")
    assert tags_info["count"] == 1

    tags_info = Question.get_tag_progress(question[0].user, tag[2])
    assert str(tags_info["name"]) == "linux"
    assert tags_info["progress"] == 0
    assert tags_info["last_reviewed"] == "Never"
    assert tags_info["count"] == 0


def test_drill_get_disabled_tags(authenticated_client, tag):

    user, client = authenticated_client()

    QuestionFactory(user=user)
    question_1 = QuestionFactory(user=user, is_disabled=True)
    question_1.tags.add(tag[0])

    questions = Question.objects.get_disabled_tags(user)

    assert len(questions) == 1
    assert tag[0].name in [x["name"] for x in questions]


def test_drill_get_disabled_tags_excludes_other_users(authenticated_client, tag):
    """Disabled tags from other users should not appear."""
    from accounts.tests.factories import UserFactory

    user, _ = authenticated_client()

    # Create a disabled question owned by a different user
    other_user = UserFactory(username="other_user")
    other_question = QuestionFactory(user=other_user, is_disabled=True)
    other_question.tags.add(tag[0])

    questions = Question.objects.get_disabled_tags(user)
    assert len(questions) == 0


def test_get_intervals_description_only():
    """get_intervals(description_only=True) returns only description keys."""
    question = QuestionFactory()
    intervals = question.get_intervals(description_only=True)

    for key in ("good", "easy", "hard", "reset"):
        assert "description" in intervals[key]
        assert "interval" not in intervals[key]
        assert "interval_index" not in intervals[key]


def test_record_response_invalid():
    """record_response raises ValueError for invalid response strings."""
    question = QuestionFactory()

    with pytest.raises(ValueError, match="Invalid response value"):
        question.record_response("invalid")
