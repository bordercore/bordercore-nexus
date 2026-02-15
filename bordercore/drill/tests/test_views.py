import json
from pathlib import Path
from unittest.mock import Mock

import pytest
import responses

from django import urls

from drill.models import Question, QuestionToObject
from drill.tests.factories import QuestionFactory
from drill.views import handle_related_objects

pytestmark = [pytest.mark.django_db]


@pytest.fixture
def monkeypatch_drill(monkeypatch):
    """
    Prevent the question object from interacting with Elasticsearch by
    patching out the Question.delete() method
    """

    def mock(*args, **kwargs):
        pass
    monkeypatch.setattr(Question, "delete", mock)


def test_drill_list(authenticated_client, question, django_assert_num_queries):

    _, client = authenticated_client()

    url = urls.reverse("drill:list")
    resp = client.get(url)

    assert resp.status_code == 200


def test_drill_create(authenticated_client, question):

    _, client = authenticated_client()

    # The empty form
    url = urls.reverse("drill:add")
    resp = client.get(url)

    assert resp.status_code == 200

    # The submitted form
    url = urls.reverse("drill:add")
    resp = client.post(url, {
        "question": "Sample Question",
        "answer": "Sample Answer",
        "tags": "django"
    })

    assert resp.status_code == 302


def test_drill_handle_related_objects(monkeypatch_drill, authenticated_client, question, bookmark):

    user, client = authenticated_client()

    mock_request = Mock()
    mock_request.user = user
    mock_request.POST = {
        "related-objects": json.dumps(
            [
                {
                    "uuid": str(bookmark[0].uuid),
                    "note": ""
                }
            ]
        )
    }

    handle_related_objects(question[1], mock_request)

    assert QuestionToObject.objects.filter(node=question[1], bookmark=bookmark[0]).exists()


def test_drill_delete(monkeypatch_drill, authenticated_client, question):

    _, client = authenticated_client()

    url = urls.reverse("drill:delete", kwargs={"uuid": question[0].uuid})
    resp = client.post(url, {})

    assert resp.status_code == 302


def test_drill_detail(authenticated_client, question):

    _, client = authenticated_client()

    url = urls.reverse("drill:detail", kwargs={"uuid": question[0].uuid})
    resp = client.get(url)

    assert resp.status_code == 200


def test_drill_update(authenticated_client, question):

    _, client = authenticated_client()

    # The empty form
    url = urls.reverse("drill:update", kwargs={"uuid": question[0].uuid})
    resp = client.get(url)

    assert resp.status_code == 200

    # The submitted form
    url = urls.reverse("drill:update", kwargs={"uuid": question[0].uuid})
    resp = client.post(url, {
        "question": "Sample Question Changed",
        "answer": "Sample Answer Changed",
        "tags": "django"
    })

    assert resp.status_code == 302


def test_drill_start_study_session(authenticated_client, question):

    _, client = authenticated_client()

    url = urls.reverse("drill:start_study_session")
    resp = client.get(url + "?study_method=favorites&filter=review")

    assert resp.status_code == 302


def test_drill_study(authenticated_client, question):

    _, client = authenticated_client()

    session = client.session

    session["drill_study_session"] = {
        "type": "random",
        "current": str(question[0].uuid),
        "list": [str(x.uuid) for x in question]
    }
    session.save()

    url = urls.reverse(
        "drill:study"
    )

    # Study the second question
    resp = client.get(url)
    assert resp.status_code == 302
    session = client.session
    assert session["drill_study_session"]["current"] == str(question[1].uuid)

    # Study the third question
    resp = client.get(url)
    assert resp.status_code == 302
    session = client.session
    assert session["drill_study_session"]["current"] == str(question[2].uuid)

    # Study the fourth question
    resp = client.get(url)
    assert resp.status_code == 302
    session = client.session
    assert session["drill_study_session"]["current"] == str(question[3].uuid)

    # Verify that the study session is over, since we've exhausted all questions
    resp = client.get(url)
    assert resp.status_code == 302
    session = client.session
    assert "drill_study_session" not in session


def test_drill_get_current_question(authenticated_client, question):

    _, client = authenticated_client()

    session = client.session

    # Create a study session of random questions and set
    #  the current question to the second one.
    session["drill_study_session"] = {
        "type": "random",
        "current": str(question[1].uuid),
        "list": [str(x.uuid) for x in question]
    }
    session.save()

    url = urls.reverse(
        "drill:resume"
    )
    resp = client.get(url)
    assert resp.status_code == 302


def test_drill_record_response(authenticated_client, question):

    _, client = authenticated_client()

    url = urls.reverse(
        "drill:record_response",
        kwargs={
            "uuid": question[0].uuid,
            "response": "good"
        }
    )
    resp = client.get(url)

    assert resp.status_code == 302


def test_drill_get_pinned_tags(authenticated_client, question):

    _, client = authenticated_client()

    url = urls.reverse(
        "drill:get_pinned_tags"
    )
    resp = client.get(url)

    assert resp.status_code == 200


def test_drill_pin_tag(authenticated_client, question, tag):

    _, client = authenticated_client()

    url = urls.reverse("drill:pin_tag")
    resp = client.post(url, {
        "tag": tag[2].name
    })

    assert json.loads(resp.content)["status"] == "OK"
    assert resp.status_code == 200

    url = urls.reverse("drill:pin_tag")
    resp = client.post(url, {
        "tag": tag[2].name
    })

    assert json.loads(resp.content)["status"] == "ERROR"
    assert resp.status_code == 400


def test_drill_unpin_tag(authenticated_client, question, tag):

    _, client = authenticated_client()

    url = urls.reverse("drill:unpin_tag")
    resp = client.post(url, {
        "tag": tag[0].name
    })

    assert json.loads(resp.content)["status"] == "OK"
    assert resp.status_code == 200

    resp = client.post(url, {
        "tag": tag[0].name
    })

    assert json.loads(resp.content)["status"] == "ERROR"
    assert resp.status_code == 400


def test_sort_pinned_tags(authenticated_client, question, tag):

    _, client = authenticated_client()

    url = urls.reverse("drill:sort_pinned_tags")
    resp = client.post(url, {
        "tag_name": tag[0].name,
        "new_position": 1
    })

    assert json.loads(resp.content)["status"] == "OK"
    assert resp.status_code == 200


def test_drill_get_disabled_tags(authenticated_client, tag):

    user, client = authenticated_client()

    QuestionFactory(user=user)
    question_1 = QuestionFactory(user=user, is_disabled=True)
    question_1.tags.add(tag[0])

    url = urls.reverse(
        "drill:get_disabled_tags"
    )
    resp = client.get(url)

    assert resp.status_code == 200
    assert len(resp.json()["tag_list"]) == 1
    assert tag[0].name in [x["name"] for x in resp.json()["tag_list"]]


def test_drill_disable_tag(authenticated_client, tag):

    user, client = authenticated_client()

    question_0 = QuestionFactory(user=user)
    question_0.tags.add(tag[0])

    url = urls.reverse("drill:disable_tag")
    resp = client.post(url, {
        "tag": tag[0].name
    })

    assert json.loads(resp.content)["status"] == "OK"
    assert resp.status_code == 200

    question_modified = Question.objects.get(pk=question_0.pk)
    assert question_modified.is_disabled is True

    # If we try to disable the tag again, we should get an error
    url = urls.reverse("drill:disable_tag")
    resp = client.post(url, {
        "tag": tag[0].name
    })

    assert json.loads(resp.content)["status"] == "ERROR"
    assert resp.status_code == 400


def test_drill_enable_tag(authenticated_client, tag):

    user, client = authenticated_client()

    question_0 = QuestionFactory(user=user, is_disabled=True)
    question_0.tags.add(tag[0])

    url = urls.reverse("drill:enable_tag")
    resp = client.post(url, {
        "tag": tag[0].name
    })

    assert json.loads(resp.content)["status"] == "OK"
    assert resp.status_code == 200

    question_modified = Question.objects.get(pk=question_0.pk)
    assert question_modified.is_disabled is False

    # If we try to enable the tag again, we should get an error
    url = urls.reverse("drill:enable_tag")
    resp = client.post(url, {
        "tag": tag[0].name
    })

    assert json.loads(resp.content)["status"] == "ERROR"
    assert resp.status_code == 400


def test_drill_is_favorite_mutate(authenticated_client, question, tag):

    _, client = authenticated_client()

    url = urls.reverse("drill:is_favorite_mutate")
    resp = client.post(url, {
        "question_uuid": question[0].uuid,
        "mutation": "add"
    })

    assert json.loads(resp.content)["status"] == "OK"
    assert resp.status_code == 200

    # Retrieve the question from the database and verify it is now a favorite
    question_refreshed = Question.objects.get(uuid=question[0].uuid)
    assert question_refreshed.is_favorite is True

    url = urls.reverse("drill:is_favorite_mutate")
    resp = client.post(url, {
        "question_uuid": question[0].uuid,
        "mutation": "delete"
    })

    assert json.loads(resp.content)["status"] == "OK"
    assert resp.status_code == 200

    # Retrieve the question from the database and verify it is no longer a favorite
    question_refreshed = Question.objects.get(uuid=question[0].uuid)
    assert question_refreshed.is_favorite is False


@responses.activate
def test_get_title_from_url(authenticated_client, bookmark):

    _, client = authenticated_client()

    with open(Path(__file__).parent / "resources/bordercore.html") as f:
        html = f.read()

    responses.add(responses.GET, "https://www.bordercore.com/bookmarks/", body=html)

    url = urls.reverse("drill:get_title_from_url")

    # Test existing bookmark
    resp = client.get(f"{url}?url={bookmark[0].url}")
    content = json.loads(resp.content)
    assert content["status"] == "OK"
    assert resp.status_code == 200
    assert content["bookmarkUuid"] == str(bookmark[0].uuid)
    assert content["title"] == bookmark[0].name

    # Test new bookmark
    resp = client.get(f"{url}?url=https://www.bordercore.com/bookmarks/")
    content = json.loads(resp.content)
    assert content["status"] == "OK"
    assert resp.status_code == 200
    assert content["bookmarkUuid"] is None
    assert content["title"] == "Bordercore Bookmarks"


def test_drill_get_related_objects(authenticated_client, question, blob_note):

    _, client = authenticated_client()

    question[0].add_related_object(blob_note[0].uuid)

    url = urls.reverse("drill:related_objects", kwargs={"uuid": question[0].uuid})

    resp = client.get(url)

    content = json.loads(resp.content)
    assert content["status"] == "OK"
    assert len(content["related_objects"]) == 3
    assert content["related_objects"][0]["name"] == blob_note[0].name
    assert content["related_objects"][0]["uuid"] == str(blob_note[0].uuid)


def test_drill_add_object(authenticated_client, question, blob_note):

    _, client = authenticated_client()

    url = urls.reverse("blob:add_related_object")
    resp = client.post(url, {
        "node_uuid": question[0].uuid,
        "object_uuid": blob_note[0].uuid,
        "node_type": "drill"
    })

    assert resp.status_code == 200
    assert QuestionToObject.objects.filter(node=question[0], blob=blob_note[0]).exists()
    assert QuestionToObject.objects.filter(node=question[0]).count() == 3


def test_drill_remove_object(authenticated_client, question, blob_note):

    _, client = authenticated_client()

    question[0].add_related_object(blob_note[0].uuid)

    url = urls.reverse("blob:remove_related_object")
    resp = client.post(url, {
        "node_uuid": question[0].uuid,
        "object_uuid": blob_note[0].uuid,
        "node_type": "drill"
    })

    assert resp.status_code == 200
    assert not QuestionToObject.objects.filter(node=question[0], blob=blob_note[0]).exists()
    assert QuestionToObject.objects.filter(node=question[0]).count() == 2


def test_drill_update_related_object_note(authenticated_client, question, blob_note):

    _, client = authenticated_client()

    question[0].add_related_object(blob_note[0].uuid)

    note = "Updated Note"

    url = urls.reverse("blob:update_related_object_note")
    resp = client.post(url, {
        "node_uuid": question[0].uuid,
        "object_uuid": blob_note[0].uuid,
        "note": note,
        "node_type": "drill"
    })

    assert resp.status_code == 200

    question_to_object = QuestionToObject.objects.get(node=question[0], blob=blob_note[0])
    # bc_object = question[0].bc_objects.filter(blob=blob_note[0]).first()
    assert question_to_object.note == note
