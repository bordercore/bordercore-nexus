import pytest

from tag.tests.factories import TagFactory
from todo.tests.factories import TodoFactory


@pytest.fixture()
def todo():

    TagFactory.reset_sequence(0)
    TodoFactory.reset_sequence(0)

    task_1 = TodoFactory(priority=1)
    task_2 = TodoFactory(priority=1)
    task_3 = TodoFactory()

    tag_1 = TagFactory()
    tag_2 = TagFactory()

    task_1.tags.add(tag_1)
    task_2.tags.add(tag_1)
    task_3.tags.add(tag_1)
    task_3.tags.add(tag_2)

    yield task_3
