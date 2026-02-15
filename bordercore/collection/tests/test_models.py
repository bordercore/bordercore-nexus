import pytest

from blob.tests.factories import BlobFactory
from collection.models import CollectionObject
from lib.exceptions import DuplicateObjectError

pytestmark = [pytest.mark.django_db]


def test_sort_collection(collection, blob_image_factory, blob_pdf_factory):

    # Move the first blob to the second position
    so = CollectionObject.objects.get(collection=collection[0], blob=blob_pdf_factory[0])
    CollectionObject.reorder(so, 2)
    so = CollectionObject.objects.filter(collection=collection[0])
    assert so[0].blob.id == blob_image_factory[0].id
    assert so[1].blob.id == blob_pdf_factory[0].id
    assert collection[0].collectionobject_set.filter().count() == 2

    # Move it back the first position
    so = CollectionObject.objects.get(collection=collection[0], blob=blob_pdf_factory[0])
    CollectionObject.reorder(so, 1)
    so = CollectionObject.objects.filter(collection=collection[0])
    assert so[0].blob.id == blob_pdf_factory[0].id
    assert so[1].blob.id == blob_image_factory[0].id
    assert collection[0].collectionobject_set.filter().count() == 2

    # Move the second blob to the first position
    so = CollectionObject.objects.get(collection=collection[0], blob=blob_image_factory[0])
    CollectionObject.reorder(so, 1)
    so = CollectionObject.objects.filter(collection=collection[0])
    assert so[0].blob.id == blob_image_factory[0].id
    assert so[1].blob.id == blob_pdf_factory[0].id
    assert collection[0].collectionobject_set.filter().count() == 2


def test_get_tags(collection):

    # Use set() since get_tags() doesn't guarantee sort order
    assert set([x.strip() for x in collection[0].get_tags().split(",")]) == set(["django", "linux"])


def test_get_blob(collection):

    next_blob = collection[0].get_blob(-1, "next")
    assert next_blob["index"] == 0


def test_get_object_list(collection, blob_image_factory, blob_pdf_factory):

    blob_list = collection[0].get_object_list()["object_list"]

    assert len(blob_list) == 2
    assert blob_list[0]["uuid"] == blob_pdf_factory[0].uuid
    assert blob_list[1]["uuid"] == blob_image_factory[0].uuid
    assert blob_list[0]["name"] == blob_pdf_factory[0].name
    assert blob_list[1]["name"] == blob_image_factory[0].name


def test_add_object(collection):

    blob = BlobFactory(user=collection[0].user)

    collection[0].add_object(blob)

    assert CollectionObject.objects.filter(
        collection=collection[0],
        blob=blob
    ).exists()

    # Test for adding a duplicate blob
    with pytest.raises(DuplicateObjectError):
        collection[0].add_object(blob)


def test_remove_object(collection):

    blob = BlobFactory(user=collection[0].user)

    collection[0].add_object(blob)

    collection[0].remove_object(blob.uuid)

    assert not CollectionObject.objects.filter(
        collection=collection[0],
        blob=blob
    ).exists()
