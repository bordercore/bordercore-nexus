import pytest

from django.db.models import Max, Min

from search.models import RecentSearch

pytestmark = pytest.mark.django_db


def test_recent_search_add(authenticated_client):

    user, client = authenticated_client()

    RecentSearch.add(user, "first search")
    RecentSearch.add(user, "second search")
    RecentSearch.add(user, "third search")

    assert RecentSearch.objects.all().count() == 3

    assert RecentSearch.objects.all().aggregate(
        Min("sort_order")
    )["sort_order__min"] == 1

    assert RecentSearch.objects.all().aggregate(
        Max("sort_order")
    )["sort_order__max"] == 3
