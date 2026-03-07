import pytest
from django.http import Http404

from lib.mixins import get_user_object_or_404
from todo.models import Todo
from todo.tests.factories import TodoFactory
from accounts.tests.factories import UserFactory

pytestmark = [pytest.mark.django_db]


def test_returns_object_when_it_belongs_to_user():
    """Returns the object when it belongs to the requesting user."""
    todo = TodoFactory()
    result = get_user_object_or_404(todo.user, Todo, uuid=todo.uuid)
    assert result == todo


def test_raises_404_when_object_belongs_to_different_user():
    """Raises Http404 when the object belongs to a different user."""
    todo = TodoFactory()
    other_user = UserFactory(username="otheruser")
    with pytest.raises(Http404):
        get_user_object_or_404(other_user, Todo, uuid=todo.uuid)


def test_raises_404_when_object_does_not_exist():
    """Raises Http404 when the object does not exist."""
    user = UserFactory()
    with pytest.raises(Http404):
        get_user_object_or_404(user, Todo, uuid="00000000-0000-0000-0000-000000000000")
