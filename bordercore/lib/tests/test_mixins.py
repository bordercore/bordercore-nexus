import pytest
from django.db import transaction
from django.http import Http404
from django.test import TestCase

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


def test_index_es_document_swallows_elasticsearch_failures(monkeypatch):
    """ElasticsearchMixin.index_es_document must log and continue when
    the underlying ES call raises, mirroring delete_from_elasticsearch.

    Postgres is the source of truth; ES is a derived index. An ES outage
    must never propagate out and break a Postgres write.
    """
    def boom(doc):
        raise RuntimeError("elasticsearch unreachable")
    monkeypatch.setattr("lib.mixins.index_document", boom)

    user = UserFactory(username="es_swallow", email="es@example.com")

    # captureOnCommitCallbacks(execute=True) forces queued on_commit
    # callbacks to run inline. If the mixin's deferred callback let the
    # ES error propagate, the `with` block would raise.
    with TestCase.captureOnCommitCallbacks(execute=True) as callbacks:
        todo = Todo.objects.create(user=user, name="Resilient")

    assert todo.pk is not None
    assert len(callbacks) >= 1


def test_index_es_document_is_deferred_until_commit(monkeypatch):
    """index_es_document must queue a transaction.on_commit callback rather
    than calling index_document synchronously, so ES never sees a row that
    Postgres later rolls back.
    """
    calls = []
    monkeypatch.setattr("lib.mixins.index_document", lambda doc: calls.append(doc))

    user = UserFactory(username="es_defer", email="defer@example.com")
    with transaction.atomic():
        todo = Todo.objects.create(user=user, name="Deferred")
        # Inside the atomic block, on_commit has not fired. If the mixin
        # called index_document synchronously, calls would already have an
        # entry. Since the outer pytest-django transaction wraps this too,
        # the on_commit callback never fires for the lifetime of this test
        # — but the synchronous-vs-deferred distinction is observable right
        # here.
        assert calls == [], (
            f"index_es_document called sync inside atomic block; expected "
            f"deferred via on_commit. Got {len(calls)} call(s)."
        )
    assert todo.pk is not None
