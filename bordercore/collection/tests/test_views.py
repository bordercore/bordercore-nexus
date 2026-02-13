import logging
from unittest.mock import patch

import pytest
from faker import Factory as FakerFactory

from django import urls
from django.conf import settings

from blob.tests.factories import BlobFactory
from bookmark.models import Bookmark
from bookmark.tests.factories import BookmarkFactory
from collection.models import Collection, CollectionObject

pytestmark = [pytest.mark.django_db]

faker = FakerFactory.create()


def test_collection_list(auto_login_user, collection):

    _, client = auto_login_user()

    url = urls.reverse("collection:list")
    resp = client.get(url)
    assert resp.context["title"] == "Collection List"
    assert len(resp.context_data["collection_list"]) == 2
    assert resp.status_code == 200


def test_collection_detail(auto_login_user, collection):

    # Quiet spurious output
    settings.NPLUSONE_WHITELIST = [
        {
            "label": "unused_eager_load",
            "model": "collection.CollectionObject"
        }
    ]
    logger = logging.getLogger("bordercore.blob.models")
    logger.propagate = False

    user, client = auto_login_user()

    url = urls.reverse("collection:detail", kwargs={"uuid": collection[0].uuid})
    resp = client.get(url)

    assert resp.status_code == 200

    for so in CollectionObject.objects.filter(collection=collection[0]):
        so.blob.delete()

    url = urls.reverse("collection:detail", kwargs={"uuid": collection[0].uuid})
    resp = client.get(url)

    assert resp.status_code == 200

    # Test collections with blobs with no "null" names
    blob = BlobFactory(user=user, name=None)
    collection[0].add_object(blob)

    url = urls.reverse("collection:detail", kwargs={"uuid": collection[0].uuid})
    resp = client.get(url)

    assert resp.status_code == 200


def test_sort_collection(auto_login_user, collection):

    _, client = auto_login_user()

    url = urls.reverse("collection:sort_objects")
    resp = client.post(url, {
        "collection_uuid": collection[0].uuid,
        "object_uuid": collection[0].collectionobject_set.all()[0].blob.uuid,
        "new_position": "3"
    })

    assert resp.status_code == 200


def test_get_blob(auto_login_user, collection):

    _, client = auto_login_user()

    url = urls.reverse("collection:get_blob", kwargs={
        "collection_uuid": collection[0].uuid
    })
    resp = client.get(f"{url}?position=1")

    assert resp.status_code == 200


def test_create_collection(auto_login_user, collection):

    _, client = auto_login_user()

    url = urls.reverse("collection:create")
    resp = client.post(url, {
        "name": "Collection name",
        "description": "Collection description",
        "tags": "django"
    })

    assert resp.status_code == 302
    assert Collection.objects.count() == 3


def test_update_collection(auto_login_user, collection):

    _, client = auto_login_user()

    name = faker.text()

    url = urls.reverse("collection:update", kwargs={"uuid": collection[0].uuid})
    resp = client.post(url, {
        "name": name,
        "tags": "django"
    })

    assert resp.status_code == 302
    updated_collection = Collection.objects.get(uuid=collection[0].uuid)
    assert updated_collection.name == name


def test_delete_collection(auto_login_user, collection):

    # Quiet spurious output
    settings.NPLUSONE_WHITELIST = [
        {
            "label": "unused_eager_load",
            "model": "collection.Collection"
        }
    ]

    _, client = auto_login_user()

    url = urls.reverse("collection-detail", kwargs={"uuid": collection[0].uuid})
    resp = client.delete(url)

    assert resp.status_code == 204


def test_search(auto_login_user, collection, blob_image_factory, blob_pdf_factory):

    _, client = auto_login_user()

    url = urls.reverse("collection:search")
    resp = client.get(f"{url}?query=Display")

    assert resp.status_code == 200

    payload = resp.json()

    assert len(payload) == 1

    assert payload[0]["name"] == collection[1].name
    assert payload[0]["num_objects"] == 1


def test_collection_object_list(auto_login_user, collection, blob_image_factory, blob_pdf_factory):

    # Quiet spurious output
    settings.NPLUSONE_WHITELIST = [
        {
            "label": "unused_eager_load",
            "model": "collection.CollectionObject"
        }
    ]

    _, client = auto_login_user()

    url = urls.reverse("collection:get_object_list", kwargs={"collection_uuid": collection[0].uuid})
    resp = client.get(f"{url}?query=Display")

    assert resp.status_code == 200

    payload = resp.json()

    assert len(payload) == 2

    assert blob_image_factory[0].name in [x["name"] for x in payload["object_list"]]
    assert blob_pdf_factory[0].name in [x["name"] for x in payload["object_list"]]


def test_collection_get_object_list(auto_login_user, collection):

    # Quiet spurious output
    settings.NPLUSONE_WHITELIST = [
        {
            "label": "unused_eager_load",
            "model": "collection.CollectionObject"
        }
    ]

    _, client = auto_login_user()

    url = urls.reverse("collection:get_object_list", kwargs={
        "collection_uuid": collection[0].uuid
    })
    resp = client.get(url)

    assert resp.status_code == 200

    resp_json = resp.json()

    assert len(resp_json["object_list"]) == 2

    blob_list = collection[0].collectionobject_set.all()
    assert str(blob_list[0].blob.uuid) in [
        x["uuid"] for x in resp_json["object_list"]
    ]
    assert str(blob_list[1].blob.uuid) in [
        x["uuid"] for x in resp_json["object_list"]
    ]


def test_add_object(auto_login_user, collection, blob_image_factory):

    _, client = auto_login_user()

    url = urls.reverse("collection:add_object")
    resp = client.post(url, {
        "collection_uuid": collection[1].uuid,
        "blob_uuid": blob_image_factory[0].uuid
    })

    assert resp.status_code == 200

    # Test for adding a duplicate blob
    resp = client.post(url, {
        "collection_uuid": collection[1].uuid,
        "blob_uuid": blob_image_factory[0].uuid
    })
    assert resp.status_code == 400
    assert resp.json()["status"] == "ERROR"


def test_remove_object(auto_login_user, collection, blob_image_factory):

    _, client = auto_login_user()

    url = urls.reverse("collection:remove_object")
    resp = client.post(url, {
        "collection_uuid": collection[0].uuid,
        "object_uuid": blob_image_factory[0].uuid
    })

    assert resp.status_code == 200


@patch("collection.views.parse_title_from_url")
def test_add_new_bookmark(mock_parse_title_from_url, monkeypatch_bookmark, auto_login_user, collection, blob_image_factory):

    user, client = auto_login_user()

    mock_parse_title_from_url.return_value = None, "Bogus Title"

    url = faker.image_url()
    bookmark = BookmarkFactory(user=user, url=url)

    # Adding an exist bookmark
    url = urls.reverse("collection:add_new_bookmark")
    resp = client.post(url, {
        "collection_uuid": collection[0].uuid,
        "url": bookmark.url
    })

    assert resp.status_code == 200
    assert resp.json()["status"] == "OK"
    assert CollectionObject.objects.filter(collection=collection[0], bookmark=bookmark).exists()

    # Adding a new bookmark
    bookmark_url = faker.image_url()
    url = urls.reverse("collection:add_new_bookmark")
    resp = client.post(url, {
        "collection_uuid": collection[0].uuid,
        "url": bookmark_url
    })

    assert resp.status_code == 200
    assert resp.json()["status"] == "OK"
    bookmark = Bookmark.objects.get(url=bookmark_url)
    assert CollectionObject.objects.filter(collection=collection[0], bookmark=bookmark).exists()

    # Adding a duplicate bookmark
    url = urls.reverse("collection:add_new_bookmark")
    resp = client.post(url, {
        "collection_uuid": collection[0].uuid,
        "url": bookmark.url
    })

    assert resp.status_code == 400
    assert resp.json()["status"] == "ERROR"
