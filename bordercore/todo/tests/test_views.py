import factory
import pytest

from django import urls
from django.conf import settings
from django.db.models import signals

from accounts.tests.factories import TEST_PASSWORD, UserFactory
from todo.views import Todo

pytestmark = [pytest.mark.django_db]


def test_todo_list_empty(authenticated_client):

    _, client = authenticated_client()

    url = urls.reverse("todo:list")
    resp = client.get(url)

    assert resp.status_code == 200


def test_todo_list(authenticated_client, todo):

    _, client = authenticated_client()

    url = urls.reverse("todo:list")
    resp = client.get(url)

    assert resp.status_code == 200


@factory.django.mute_signals(signals.post_save)
def test_todo_create(authenticated_client, todo):

    _, client = authenticated_client()

    url = urls.reverse("todo-list")
    resp = client.post(url, {
        "name": "Sample Task",
        "priority": "2",
        "tags": "django"
    })

    assert resp.status_code == 201

    uuid = resp.json()["uuid"]
    todo = Todo.objects.get(uuid=uuid)
    assert todo.name == "Sample Task"
    assert todo.priority == 2
    assert "django" in [x.name for x in todo.tags.all()]


@factory.django.mute_signals(signals.post_save)
def test_todo_update(authenticated_client, todo):

    # Quiet spurious output
    settings.NPLUSONE_WHITELIST = [
        {
            "label": "unused_eager_load",
            "model": "todo.Todo"
        }
    ]

    _, client = authenticated_client()

    url = urls.reverse("todo-detail", kwargs={"uuid": todo.uuid})
    resp = client.put(
        url,
        content_type="application/json",
        data={
            "todo_uuid": todo.uuid,
            "name": "New Task Name",
            "priority": "3",
            "tags": ["django"]
        }
    )

    assert resp.status_code == 200

    todo = Todo.objects.get(uuid=todo.uuid)
    assert todo.name == "New Task Name"
    assert todo.priority == 3
    assert "django" in [x.name for x in todo.tags.all()]


@factory.django.mute_signals(signals.post_save)
def test_todo_update_without_tags(authenticated_client, todo):
    """Updating a todo without tags should preserve existing tags."""

    settings.NPLUSONE_WHITELIST = [
        {
            "label": "unused_eager_load",
            "model": "todo.Todo"
        }
    ]

    _, client = authenticated_client()
    original_tags = list(todo.tags.values_list("name", flat=True))

    url = urls.reverse("todo-detail", kwargs={"uuid": todo.uuid})
    resp = client.put(
        url,
        content_type="application/json",
        data={
            "todo_uuid": todo.uuid,
            "name": "Updated Name Only",
            "priority": "2",
        }
    )

    assert resp.status_code == 200

    todo.refresh_from_db()
    assert todo.name == "Updated Name Only"
    assert list(todo.tags.values_list("name", flat=True)) == original_tags


def test_sort_todo_success():
    """Test successful todo reordering."""
    import uuid
    from unittest.mock import Mock, patch

    from rest_framework.response import Response
    from rest_framework.test import APIRequestFactory

    from todo.views import sort_todo
    factory = APIRequestFactory()
    user = Mock()
    user.id = 1
    request = factory.post("/sort/", {
        "tag": "work",
        "todo_uuid": str(uuid.uuid4()),
        "position": "2"
    })
    request.user = user

    mock_tag_todo = Mock()

    with patch("todo.views.get_object_or_404", return_value=mock_tag_todo) as mock_get:
        with patch("todo.views.TagTodo.reorder") as mock_reorder:
            response = sort_todo(request)

            assert isinstance(response, Response)
            assert response.data["status"] == "OK"
            assert response.data["new_position"] == 2
            mock_reorder.assert_called_once_with(mock_tag_todo, 2)


def test_sort_todo(authenticated_client, todo):

    _, client = authenticated_client()

    url = urls.reverse("todo:sort")
    resp = client.post(url, {
        "tag": "tag_0",
        "todo_uuid": todo.uuid,
        "position": "2"
    })

    assert resp.status_code == 200


def test_sort_todo_invalid_position(authenticated_client, todo):
    """Non-integer position returns 400."""

    _, client = authenticated_client()

    url = urls.reverse("todo:sort")
    resp = client.post(url, {
        "tag": "tag_0",
        "todo_uuid": todo.uuid,
        "position": "abc"
    })

    assert resp.status_code == 400
    assert resp.json()["status"] == "ERROR"


def test_sort_todo_negative_position(authenticated_client, todo):
    """Position < 1 returns 400."""

    _, client = authenticated_client()

    url = urls.reverse("todo:sort")
    resp = client.post(url, {
        "tag": "tag_0",
        "todo_uuid": todo.uuid,
        "position": "0"
    })

    assert resp.status_code == 400
    assert resp.json()["status"] == "ERROR"


def test_sort_todo_missing_fields(authenticated_client, todo):
    """Missing required POST fields returns 400."""

    _, client = authenticated_client()

    url = urls.reverse("todo:sort")
    resp = client.post(url, {
        "tag": "tag_0",
    })

    assert resp.status_code == 400


def test_sort_todo_wrong_user(authenticated_client, client, todo):
    """Sorting another user's todo returns 404."""

    other_user = UserFactory(username="otheruser")
    client.login(username="otheruser", password=TEST_PASSWORD)

    url = urls.reverse("todo:sort")
    resp = client.post(url, {
        "tag": "tag_0",
        "todo_uuid": todo.uuid,
        "position": "1"
    })

    assert resp.status_code == 404


def test_move_to_top(authenticated_client, todo):

    _, client = authenticated_client()

    url = urls.reverse("todo:move_to_top")
    resp = client.post(url, {
        "tag": "tag_0",
        "todo_uuid": todo.uuid,
    })

    assert resp.status_code == 200


def test_snooze_task(authenticated_client, todo):
    """Snoozing a task sets its due_date to ~1 day from now."""
    from django.utils import timezone

    _, client = authenticated_client()

    url = urls.reverse("todo:snooze_task")
    resp = client.post(url, {
        "todo_uuid": todo.uuid,
    })

    assert resp.status_code == 200
    assert resp.json()["status"] == "OK"

    todo.refresh_from_db()
    assert todo.due_date is not None
    assert todo.due_date > timezone.now()


def test_todo_list_with_uuid(authenticated_client, todo):
    """Accessing the todo list with a UUID sets the tag filter."""

    _, client = authenticated_client()

    url = urls.reverse("todo:detail", kwargs={"uuid": todo.uuid})
    resp = client.get(url)

    assert resp.status_code == 200
    assert str(todo.uuid) in str(resp.context["uuid"])


def test_todo_list_with_uuid_wrong_user(authenticated_client, client, todo):
    """Accessing a todo UUID belonging to another user returns 404."""

    other_user = UserFactory(username="otheruser2")
    client.login(username="otheruser2", password=TEST_PASSWORD)

    url = urls.reverse("todo:detail", kwargs={"uuid": todo.uuid})
    resp = client.get(url)

    assert resp.status_code == 404


def test_todo_task_list_search(authenticated_client, mock_elasticsearch):
    """The search path returns results from the mocked ES client."""

    _, client = authenticated_client()

    url = urls.reverse("todo:get_tasks")
    resp = client.get(url, {"search": "test query"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OK"
    assert isinstance(data["todo_list"], list)
    mock_elasticsearch.search.assert_called_once()
