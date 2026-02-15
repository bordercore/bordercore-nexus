import pytest
from feed.models import Feed

from django import urls

pytestmark = [pytest.mark.django_db]


def test_feed_list(authenticated_client, feed):

    _, client = authenticated_client()

    url = urls.reverse("feed:list")
    resp = client.get(url)

    assert resp.status_code == 200


def test_feed_delete(authenticated_client, feed):

    _, client = authenticated_client()

    feed[0].feeditem_set.all().delete()

    url = urls.reverse("feed-detail", kwargs={"uuid": feed[0].uuid})
    resp = client.delete(url)

    assert resp.status_code == 204

    assert Feed.objects.filter(uuid=feed[0].uuid).count() == 0


def test_sort_feed(authenticated_client, feed):

    _, client = authenticated_client()

    url = urls.reverse("feed:sort")
    resp = client.post(url, {"feed_id": feed[0].id, "position": "2"})

    assert resp.status_code == 200
