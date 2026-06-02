import pytest
import responses
from elasticsearch_dsl import Range

from api.serializers import BlobSerializer, BlobSha1sumSerializer
from blob.elasticsearch_indexer import (get_blob_info, get_doctype,
                                        get_num_pages, get_range_from_date,
                                        get_unixtime_from_string,
                                        is_ingestible_file)


def test_is_ingestible_file():

    assert is_ingestible_file("foobar.pdf") is True
    assert is_ingestible_file("foobar.mp4") is False


def test_get_blob_info(blob_image_factory):

    url = f"https://www.bordercore.com/api/blobs/{blob_image_factory[0].uuid}/"
    serializer = BlobSerializer(blob_image_factory[0])
    responses.add(responses.GET, url,
                  json=serializer.data, status=200)

    blob_info = get_blob_info(uuid=blob_image_factory[0].uuid)
    assert blob_info["name"] == blob_image_factory[0].name
    assert set(blob_info["tags"]) == set([x.name for x in blob_image_factory[0].tags.all()])
    assert set(blob_info["metadata"]) == set([x.name.lower() for x in blob_image_factory[0].metadata.all()])

    url = f"https://www.bordercore.com/api/sha1sums/{blob_image_factory[0].sha1sum}/"
    serializer = BlobSha1sumSerializer(blob_image_factory[0])
    responses.add(responses.GET, url,
                  json=serializer.data, status=200)

    blob_info = get_blob_info(sha1sum=blob_image_factory[0].sha1sum)
    assert blob_info["name"] == blob_image_factory[0].name
    assert set(blob_info["tags"]) == set([x.name for x in blob_image_factory[0].tags.all()])
    assert set(blob_info["metadata"]) == set([x.name.lower() for x in blob_image_factory[0].metadata.all()])


def test_get_unixtime_from_string():

    assert get_unixtime_from_string(None) is None
    assert get_unixtime_from_string("") is None
    assert get_unixtime_from_string("2021-03-01 14:52:23") == "1614628343"
    assert get_unixtime_from_string("2021-03-01") == "1614574800"
    assert get_unixtime_from_string("2021-03") == "1614574800"
    assert get_unixtime_from_string("2021") == "1609477200"
    assert get_unixtime_from_string("[2021-03 TO 2021-04]") == "1614574800"

    with pytest.raises(ValueError):
        get_unixtime_from_string("March 1, 2021")


def test_get_doctype():

    blob = {"is_note": True}
    assert get_doctype(blob, {}) == "note"

    blob = {"is_note": ""}
    metadata = {"is_book": True}
    assert get_doctype(blob, metadata) == "book"

    blob = {"sha1sum": True, "is_note": ""}
    assert get_doctype(blob, {}) == "blob"

    blob = {"sha1sum": None, "is_note": ""}
    assert get_doctype(blob, {}) == "document"


def test_get_range_from_date():

    date = "2021-03-01"
    assert get_range_from_date(date) == Range(gte=date, lte=date)

    date1 = "2021-03"
    date2 = "2021-04"
    date = f"[{date1} TO {date2}]"
    assert get_range_from_date(date) == Range(gte=date1, lte=date2)


def test_get_num_pages(blob_pdf_factory):

    assert get_num_pages(blob_pdf_factory[0].file.read()) == 2


@pytest.mark.data_quality
def test_esblob_save_update_roundtrip():
    """ESBlob.save + upsert + get work on elasticsearch-dsl 8 against ES8.

    Mirrors the indexer's real pattern: each write uses a *freshly constructed*
    ESBlob with an explicit meta.id (never a doc fetched via .get()). A fetched
    doc carries _seq_no/_primary_term, which dsl 8 turns into an optimistic-
    concurrency check that ES rejects when combined with doc_as_upsert.
    """
    import os

    from elasticsearch_dsl.connections import connections

    from blob.elasticsearch_indexer import ESBlob

    connections.create_connection(hosts=[os.environ["ELASTICSEARCH_ENDPOINT"]])
    test_id = "dsl8-roundtrip-test"
    try:
        # new-blob path: fresh instance + save
        doc = ESBlob(name="dsl8 roundtrip", user_id=1)
        doc.meta.id = test_id
        doc.save()
        assert ESBlob.get(id=test_id).name == "dsl8 roundtrip"

        # existing-blob path: fresh instance + doc_as_upsert (as the indexer does)
        upsert = ESBlob(name="dsl8 updated", user_id=1)
        upsert.meta.id = test_id
        upsert.update(doc_as_upsert=True, name="dsl8 updated")
        assert ESBlob.get(id=test_id).name == "dsl8 updated"
    finally:
        ESBlob(meta={"id": test_id}).delete()
