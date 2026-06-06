from datetime import timedelta

import pytest
from django.test import RequestFactory
from django.utils import timezone

from lib.context_processors import (convert_django_to_bootstrap,
                                    get_overdue_tasks, has_no_autohide_tag)
from todo.tests.factories import TodoFactory


def test_convert_django_to_bootstrap():
    """Test that Django message tags are correctly mapped to Bootstrap alert classes."""

    assert convert_django_to_bootstrap("error") == "danger"
    assert convert_django_to_bootstrap("error noAutoHide") == "danger"
    assert convert_django_to_bootstrap("debug") == "info"
    assert convert_django_to_bootstrap("noAutoHide debug") == "info"
    assert convert_django_to_bootstrap("info") == "info"
    assert convert_django_to_bootstrap("success") == "success"
    assert convert_django_to_bootstrap("warning") == "warning"


def test_has_no_autohide_tag():
    """Test that the noAutoHide tag is correctly detected in message tag strings."""

    assert has_no_autohide_tag("noAutoHide") is True
    assert has_no_autohide_tag("noAutoHide info") is True
    assert has_no_autohide_tag("error noAutoHide") is True
    assert has_no_autohide_tag("warning") is False


@pytest.mark.django_db
def test_get_overdue_tasks_does_not_mutate_due_date(authenticated_client):
    """The context processor must report overdue tasks without clearing due_date."""
    user, _ = authenticated_client()
    due = timezone.now() - timedelta(days=2)
    todo = TodoFactory(user=user, due_date=due)

    request = RequestFactory().get("/")
    request.user = user

    result = get_overdue_tasks(request)
    assert [t["uuid"] for t in result["overdue_tasks"]] == [todo.uuid]

    # due_date is preserved (no destructive write), so the task stays overdue
    # on subsequent renders.
    todo.refresh_from_db()
    assert todo.due_date == due
    assert len(get_overdue_tasks(request)["overdue_tasks"]) == 1
