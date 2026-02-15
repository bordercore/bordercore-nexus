import pytest

from django.contrib.auth.models import User

from accounts.tests.factories import TEST_USERNAME
from todo.models import Todo

pytestmark = [pytest.mark.django_db]


def test_get_tags(todo):

    assert todo.get_tags() == "tag_0, tag_1"


def test_get_priority_name():

    assert Todo.get_priority_name(1) == "High"
    assert Todo.get_priority_name(2) == "Medium"
    assert Todo.get_priority_name(3) == "Low"
    assert Todo.get_priority_name(4) is None


def test_get_priority_value():

    assert Todo.get_priority_value("High") == 1
    assert Todo.get_priority_value("Medium") == 2
    assert Todo.get_priority_value("Low") == 3
    assert Todo.get_priority_value("Bogus") is None


def test_get_todo_counts(todo):

    user = User.objects.get(username=TEST_USERNAME)

    counts = Todo.get_todo_counts(user)
    assert counts[0]["count"] == 3
    assert counts[1]["count"] == 1
