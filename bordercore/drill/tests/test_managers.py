from datetime import datetime, timedelta

import pytest

from django.utils import timezone

from accounts.models import DrillTag
from accounts.tests.factories import UserFactory
from drill.models import Question, QuestionResponse
from drill.tests.factories import QuestionFactory
from tag.tests.factories import TagFactory

pytestmark = [pytest.mark.django_db]


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

    recent_tags = Question.objects.recent_tags(user)[:2]

    assert tag_1.name in [x["name"] for x in recent_tags]
    assert tag_2.name in [x["name"] for x in recent_tags]
    assert tag_0.name not in [x["name"] for x in recent_tags]


def test_tags_needing_review_filters_and_sorts():
    user = UserFactory()
    tag_old = TagFactory(user=user, name="oldest")
    tag_mid = TagFactory(user=user, name="middle")
    tag_new = TagFactory(user=user, name="newer")
    tag_clean = TagFactory(user=user, name="clean")
    tag_disabled_only = TagFactory(user=user, name="disabled-only")

    QuestionFactory(user=user, last_reviewed=timezone.now() - timedelta(days=400)).tags.add(tag_old)
    QuestionFactory(user=user, last_reviewed=timezone.now() - timedelta(days=200)).tags.add(tag_mid)
    QuestionFactory(user=user, last_reviewed=timezone.now() - timedelta(days=100)).tags.add(tag_new)
    QuestionFactory(user=user, last_reviewed=timezone.now()).tags.add(tag_clean)
    QuestionFactory(
        user=user,
        last_reviewed=timezone.now() - timedelta(days=400),
        is_disabled=True,
    ).tags.add(tag_disabled_only)

    rows = Question.objects.tags_needing_review(user)
    names = [r["name"] for r in rows]
    assert names == ["oldest", "middle", "newer"]  # sort survives middle insertion
    assert all(r["todo"] > 0 for r in rows)


def test_batch_tag_progress_includes_todo_and_dt():
    user = UserFactory()
    tag = TagFactory(user=user, name="alpha")
    # 2 questions: one due (last_reviewed long ago), one fresh
    q_due = QuestionFactory(user=user, last_reviewed=timezone.now() - timedelta(days=400))
    q_due.tags.add(tag)
    q_fresh = QuestionFactory(user=user, last_reviewed=timezone.now())
    q_fresh.tags.add(tag)

    rows = Question.objects._batch_tag_progress(user, ["alpha"])
    assert len(rows) == 1
    row = rows[0]
    assert row["name"] == "alpha"
    assert row["count"] == 2
    assert row["todo"] == 1
    assert isinstance(row["last_reviewed_dt"], datetime)  # raw datetime, kept out of JSON path
    assert "progress" in row and "url" in row and "last_reviewed" in row


def test_responses_by_kind_counts_each_response():
    user = UserFactory()
    q = QuestionFactory(user=user)
    QuestionResponse.objects.create(question=q, response="easy")
    QuestionResponse.objects.create(question=q, response="easy")
    QuestionResponse.objects.create(question=q, response="good")
    QuestionResponse.objects.create(question=q, response="hard")

    counts = Question.objects.responses_by_kind(user)
    assert counts == {"easy": 2, "good": 1, "hard": 1, "reset": 0}


def test_recent_responses_returns_latest_first():
    user = UserFactory()
    q1 = QuestionFactory(user=user, question="elixir pattern matching")
    q2 = QuestionFactory(user=user, question="lambda calculus")
    QuestionResponse.objects.create(question=q1, response="easy")
    QuestionResponse.objects.create(question=q2, response="hard")

    out = Question.objects.recent_responses(user, n=5)
    assert len(out) == 2
    assert out[0]["question"] == "lambda calculus"
    assert out[0]["response"] == "hard"
    assert isinstance(out[0]["date"], datetime)


def test_activity_heatmap_returns_one_int_per_day():
    user = UserFactory()
    q = QuestionFactory(user=user)
    QuestionResponse.objects.create(question=q, response="easy")
    QuestionResponse.objects.create(question=q, response="good")

    out = Question.objects.activity_heatmap(user, days=28)
    assert len(out) == 28
    assert all(isinstance(n, int) for n in out)
    assert out[-1] == 2  # today should have 2 responses


def test_schedule_returns_seven_days_with_overdue_collapsed():
    user = UserFactory()
    QuestionFactory(
        user=user,
        last_reviewed=timezone.now() - timedelta(days=10),
        interval=timedelta(days=1),
    )
    QuestionFactory(
        user=user,
        last_reviewed=timezone.now() - timedelta(days=2),
        interval=timedelta(days=2),
    )
    QuestionFactory(
        user=user,
        last_reviewed=timezone.now(),
        interval=timedelta(days=2),
    )

    days = Question.objects.schedule(user, span_days=3)
    assert len(days) == 7
    today_cell = next(d for d in days if d["state"] == "today")
    assert today_cell["due"] >= 2
    assert all("date" in d and "dow" in d for d in days)


def test_featured_tag_histogram_returns_weeks_of_counts():
    user = UserFactory()
    tag = TagFactory(user=user, name="lisp")
    q = QuestionFactory(user=user)
    q.tags.add(tag)
    QuestionResponse.objects.create(question=q, response="easy")

    histo = Question.objects.featured_tag_histogram("lisp", user, weeks=12)
    assert len(histo) == 12
    assert sum(histo) == 1
    assert histo[-1] == 1  # today's response lands in the last (current) week slot


def test_reviewed_count_since():
    user = UserFactory()
    q = QuestionFactory(user=user)
    QuestionResponse.objects.create(question=q, response="easy")
    QuestionResponse.objects.create(question=q, response="good")
    yesterday = timezone.now() - timedelta(days=1)
    assert Question.objects.reviewed_count(user, since=yesterday) == 2


def test_study_streak_counts_consecutive_days():
    user = UserFactory()
    q = QuestionFactory(user=user)
    today = timezone.now()
    for offset in (0, 1, 2):
        r = QuestionResponse.objects.create(question=q, response="good")
        QuestionResponse.objects.filter(pk=r.pk).update(date=today - timedelta(days=offset))
    assert Question.objects.study_streak(user) == 3


def test_study_streak_is_zero_when_today_missing():
    user = UserFactory(username="user-streak-zero")
    q = QuestionFactory(user=user)
    yesterday = timezone.now() - timedelta(days=1)
    r = QuestionResponse.objects.create(question=q, response="good")
    QuestionResponse.objects.filter(pk=r.pk).update(date=yesterday)
    assert Question.objects.study_streak(user) == 0


def test_next_due_in_returns_humanized_delta_or_none():
    user = UserFactory()
    QuestionFactory(
        user=user,
        last_reviewed=timezone.now() - timedelta(hours=22),
        interval=timedelta(days=1),
    )
    out = Question.objects.next_due_in(user)
    assert out is not None
    assert out.endswith("m") or out.endswith("h") or out == "due now"

    user2 = UserFactory(username="user-next-due-empty")
    assert Question.objects.next_due_in(user2) is None


def test_next_due_in_returns_day_string_when_over_24h():
    user = UserFactory(username="user-next-due-over-24")
    QuestionFactory(
        user=user,
        last_reviewed=timezone.now() - timedelta(hours=2),
        interval=timedelta(days=2),  # due in ~46h
    )
    assert Question.objects.next_due_in(user) == "in 1d"


def test_next_due_in_returns_due_now_when_overdue():
    user = UserFactory(username="user-next-due-overdue")
    QuestionFactory(
        user=user,
        last_reviewed=timezone.now() - timedelta(days=5),
        interval=timedelta(days=1),
    )
    assert Question.objects.next_due_in(user) == "due now"
