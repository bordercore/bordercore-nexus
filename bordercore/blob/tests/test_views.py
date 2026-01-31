import io
import json
import uuid
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch
from urllib.parse import urlparse

import boto3
import factory
import pytest
from faker import Factory as FakerFactory
from faker_file.providers.pdf_file import PdfFileProvider
from faker_file.providers.pdf_file.generators.reportlab_generator import \
    ReportlabPdfGenerator
from PIL import Image

from django import urls
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models import signals

from blob.models import Blob, BlobTemplate, BlobToObject, MetaData
from blob.tests.factories import BlobFactory
from blob.views import handle_linked_collection, handle_metadata
from collection.models import Collection
from collection.tests.factories import CollectionFactory
from tag.tests.factories import TagFactory

try:
    from bs4 import BeautifulSoup
except ModuleNotFoundError:
    pass

pytestmark = [pytest.mark.django_db]

faker = FakerFactory.create()
faker.add_provider(PdfFileProvider)


def mock(*args, **kwargs):
    pass


@pytest.fixture
def monkeypatch_collection(monkeypatch):
    """
    Prevent the collection object from interacting with AWS by
    patching out a method.
    """

    monkeypatch.setattr(Collection, "create_collection_thumbnail", mock)


def test_blob_list(auto_login_user, blob_text_factory):

    _, client = auto_login_user()

    # The empty form
    url = urls.reverse("blob:list")
    resp = client.get(url)

    assert resp.status_code == 200


@factory.django.mute_signals(signals.post_save)
def test_blob_create(monkeypatch_blob, auto_login_user, blob_text_factory):

    _, client = auto_login_user()

    # The empty form
    url = urls.reverse("blob:create")
    resp = client.get(url)

    assert resp.status_code == 200

    # The submitted form
    url = urls.reverse("blob:create")
    resp = client.post(url, {
        "tags": "django",
        "importance": 1,
    })

    assert resp.status_code == 200

    # A blob linked to an existing blob -- empty form
    url = urls.reverse("blob:create")
    resp = client.get(url, {
        "tags": "django",
        "importance": 1,
        "linked_blob_uuid": blob_text_factory[0].uuid
    })

    assert resp.status_code == 200

    # A blob linked to an existing blob -- submitted form
    url = urls.reverse("blob:create")
    resp = client.post(url, {
        "tags": "django",
        "importance": 1,
        "linked_blob_uuid": blob_text_factory[0].uuid
    })

    assert resp.status_code == 200

    new_blob = Blob.objects.all().order_by("-created")[0]
    assert BlobToObject.objects.get(node=blob_text_factory[0], blob=new_blob).blob.uuid == new_blob.uuid

    # A new blob with a file
    file_path = Path(__file__).parent / "resources/test_blob.jpg"
    with open(file_path, "rb") as f:
        file_blob = f.read()
    file_upload = SimpleUploadedFile(file_path.name, file_blob)
    name = faker.text(max_nb_chars=10)
    url = urls.reverse("blob:create")
    resp = client.post(url, {
        "importance": 1,
        "file": file_upload,
        "filename": file_path.name,
        "name": name,
        "tags": "django",
    })

    assert resp.status_code == 200

    payload = resp.json()
    assert payload["status"] == "OK"
    blob_uuid = json.loads(resp.content)["uuid"]
    blob = Blob.objects.get(uuid=blob_uuid)
    assert blob.name == name

    s3 = boto3.resource("s3")
    bucket = s3.Bucket(settings.AWS_STORAGE_BUCKET_NAME)
    key_root = f"{settings.MEDIA_ROOT}/{blob.uuid}"

    # Verify that the blob's file is in S3
    objects = [
        x.key
        for x in list(bucket.objects.filter(Prefix=f"{key_root}/"))
    ]
    assert len(objects) == 1
    assert f"{key_root}/{file_path.name}" in objects


@factory.django.mute_signals(signals.pre_delete)
def test_blob_delete(monkeypatch_blob, auto_login_user, blob_text_factory):

    # Quiet spurious output
    settings.NPLUSONE_WHITELIST = [
        {
            "label": "unused_eager_load",
            "model": "blob.Blob"
        }
    ]

    _, client = auto_login_user()
    url = urls.reverse("blob-detail", kwargs={"uuid": blob_text_factory[0].uuid})
    resp = client.delete(url)

    assert resp.status_code == 204
    assert not Blob.objects.filter(uuid=blob_text_factory[0].uuid).exists()


@factory.django.mute_signals(signals.post_save)
def test_blob_update(monkeypatch_blob, auto_login_user, blob_text_factory, blob_pdf_factory):

    _, client = auto_login_user()

    s3 = boto3.resource("s3")
    bucket = s3.Bucket(settings.AWS_STORAGE_BUCKET_NAME)

    # The empty form
    url = urls.reverse("blob:update", kwargs={"uuid": blob_text_factory[0].uuid})
    resp = client.get(url)
    assert resp.status_code == 200

    # The submitted form
    file = faker.pdf_file(pdf_generator_cls=ReportlabPdfGenerator)
    file_upload = SimpleUploadedFile(file.data["filename"], bytes(file.data["content"], "utf-8"))
    url = urls.reverse("blob:update", kwargs={"uuid": blob_text_factory[0].uuid})
    resp = client.post(url, {
        "file": file_upload,
        "filename": blob_pdf_factory[0].file.name,
        "importance": 1,
        "name": "Name Changed",
        "note": "Note Changed",
        "tags": "django"
    })
    assert resp.status_code == 200

    # Test a blob's file is changed
    file_path = Path(__file__).parent / "resources/test_blob.jpg"
    with open(file_path, "rb") as f:
        file_blob = f.read()
    file_upload = SimpleUploadedFile(file_path.name, file_blob)
    url = urls.reverse("blob:update", kwargs={"uuid": blob_text_factory[0].uuid})
    resp = client.post(url, {
        "file": file_upload,
        "filename": file_path.name,
        "importance": 1,
        "name": "Name Changed",
        "note": "Note Changed",
        "tags": "django"
    })

    assert resp.status_code == 200

    # Verify that the blob's new file is in S3
    key_root = f"{settings.MEDIA_ROOT}/{blob_text_factory[0].uuid}"
    objects = [
        x.key
        for x in list(bucket.objects.filter(Prefix=f"{key_root}/"))
    ]
    assert len(objects) == 1
    assert f"{key_root}/{file_path.name}" in objects

    # Test a blob's filename is changed
    url = urls.reverse("blob:update", kwargs={"uuid": blob_text_factory[0].uuid})
    filename_new = faker.file_name(extension="jpg")
    resp = client.post(url, {
        "filename": filename_new,
        "tags": ""
    })
    assert resp.status_code == 200

    # Verify that the blob's new filename has been changed in S3
    bucket = s3.Bucket(settings.AWS_STORAGE_BUCKET_NAME)
    key_root = f"{settings.MEDIA_ROOT}/{blob_text_factory[0].uuid}"
    objects = [
        x.key
        for x in list(bucket.objects.filter(Prefix=f"{key_root}/"))
    ]
    assert len(objects) == 1
    assert f"{key_root}/{filename_new}" in objects


# Dynamically resolve the actual fixture named in the parametrize list (replaces lazy_fixture)
@pytest.fixture
def resolved_blob(request):
    return request.getfixturevalue(request.param)

# Indirect parametrization to inject fixture values by name (e.g., 'blob_image_factory')
@pytest.mark.parametrize("resolved_blob", ["blob_image_factory", "blob_text_factory"], indirect=["resolved_blob"])
def test_blob_detail(auto_login_user, resolved_blob):

    _, client = auto_login_user()

    mock_info = {}

    with patch.object(Blob, "get_elasticsearch_info", return_value=mock_info):
        url = urls.reverse("blob:detail", args=(resolved_blob[0].uuid,))
        resp = client.get(url)

    assert resp.status_code == 200

    soup = BeautifulSoup(resp.content, "html.parser")

    blob = resolved_blob[0]
    url_values = [x.value for x in blob.metadata.all() if x.name == "Url"]
    assert url_values, (
        f"Blob has no Url metadata (has: {[m.name for m in blob.metadata.all()]}). "
        "Fixtures must add Url metadata for this test."
    )
    url = url_values[0]
    expected_domain = urlparse(url).netloc

    author_values = [x.value for x in blob.metadata.all() if x.name == "Author"]
    assert author_values, (
        f"Blob has no Author metadata (has: {[m.name for m in blob.metadata.all()]}). "
        "Fixtures must add Author metadata for this test."
    )
    author = author_values[0]

    # Blob detail is rendered by React; assert on embedded JSON data
    blob_data_script = soup.find("script", id="blob-data", type="application/json")
    assert blob_data_script is not None, "Page must include blob-data JSON for React"
    blob_data = json.loads(blob_data_script.string)
    assert blob_data["author"] == author

    blob_urls_script = soup.find("script", id="blob-urls", type="application/json")
    assert blob_urls_script is not None, "Page must include blob-urls JSON for React"
    blob_urls = json.loads(blob_urls_script.string)
    domains = [u["domain"] for u in blob_urls]
    assert expected_domain in domains


def test_clone(monkeypatch_blob, auto_login_user):

    user, client = auto_login_user()

    blob = BlobFactory.create(user=user)

    url = urls.reverse("blob:clone", kwargs={"uuid": str(blob.uuid)})
    resp = client.get(url)

    assert resp.status_code == 302


def test_handle_metadata(auto_login_user, blob_text_factory, blob_image_factory):

    user, client = auto_login_user()

    request_mock = Mock()
    request_mock.user = user
    fake_name = faker.name()
    fake_url = faker.url()

    request_mock.POST = {
        "metadata": json.dumps(
            [
                {"name": "Artist", "value": fake_name},
                {"name": "Url", "value": fake_url}
            ]
        )
    }

    handle_metadata(blob_text_factory[0], request_mock)

    metadata = blob_text_factory[0].metadata.all()
    assert len(metadata) == 2
    assert "Artist" in [x.name for x in metadata]
    assert fake_name in [x.value for x in metadata]
    assert "Url" in [x.name for x in metadata]
    assert fake_url in [x.value for x in metadata]

    request_mock.POST = {
        "metadata": json.dumps(
            [
                {"name": "Author", "value": fake_name},
                {"name": "is_book", "value": "true"}
            ]
        )
    }

    handle_metadata(blob_image_factory[0], request_mock)

    metadata = blob_image_factory[0].metadata.all()
    assert len(metadata) == 2
    assert "Author" in [x.name for x in metadata]
    assert fake_name in [x.value for x in metadata]
    assert "is_book" in [x.name for x in metadata]


def test_handle_linked_collection(monkeypatch_collection, auto_login_user, blob_image_factory):

    user, client = auto_login_user()

    collection = CollectionFactory(user=user)

    request_mock = Mock()
    request_mock.user = user
    request_mock.POST = {
        "linked_collection": collection.uuid
    }

    handle_linked_collection(blob_image_factory[0], request_mock)

    collection_updated = Collection.objects.get(uuid=collection.uuid)

    assert blob_image_factory[0] in [x.blob for x in collection_updated.collectionobject_set.all()]


def test_blob_metadata_name_search(auto_login_user, blob_image_factory):

    _, client = auto_login_user()

    url = urls.reverse("blob:metadata_name_search")
    resp = client.get(f"{url}?query=foobar")

    assert resp.status_code == 200


def test_blob_parse_date(auto_login_user):

    _, client = auto_login_user()

    url = urls.reverse("blob:parse_date", kwargs={"input_date": "2021-01-01"})
    resp = client.get(url)
    assert resp.json() == {'output_date': '2021-01-01T00:00', 'error': None}
    assert resp.status_code == 200

    # Test a bogus date
    url = urls.reverse("blob:parse_date", kwargs={"input_date": "2021-01-34"})
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.json() == {'output_date': '', 'error': "time data '01/34/2021' does not match format '%m/%d/%Y'"}


def test_blob_update_cover_image(s3_resource, s3_bucket, auto_login_user):

    user, client = auto_login_user()

    blob_1 = BlobFactory.create(user=user)

    file_path = Path(__file__).parent / "resources/test_blob.jpg"
    img = Image.open(file_path)
    imgByteArr = io.BytesIO()
    img.save(imgByteArr, "jpeg")
    image_upload = SimpleUploadedFile(file_path.name, imgByteArr.getvalue())

    url = urls.reverse("blob:update_cover_image")
    resp = client.post(url, {
        "blob_uuid": blob_1.uuid,
        "image": image_upload,
    })

    assert resp.status_code == 200

    payload = resp.json()
    assert payload["status"] == "OK"


@patch("blob.models.Blob.get_elasticsearch_info")
def test_get_elasticsearch_info(mock_get_info, auto_login_user):
    """Test blob:get_elasticsearch_info while mocking the ES query."""

    user, client = auto_login_user()
    blob = BlobFactory.create(user=user, tags=("django", "linux"))

    # First request: simulate no result
    mock_get_info.return_value = {}

    url = urls.reverse("blob:get_elasticsearch_info", kwargs={"uuid": blob.uuid})
    resp = client.get(url)

    assert resp.status_code == 200
    assert resp.json() == {"info": {}, "status": "OK"}

    # Second request: simulate indexed blob
    mock_get_info.reset_mock()
    mock_get_info.return_value = {
        "id": str(blob.uuid),
        "name": blob.name,
        "filename": "",
        "note": blob.note,
        "doctype": "document"
    }

    url = urls.reverse("blob:get_elasticsearch_info", kwargs={"uuid": blob.uuid})
    resp = client.get(url)
    resp_json = resp.json()

    assert resp.status_code == 200
    assert resp_json["status"] == "OK"
    assert resp_json["info"]["id"] == str(blob.uuid)
    assert resp_json["info"]["name"] == blob.name
    assert resp_json["info"]["filename"] == ""
    assert resp_json["info"]["note"] == blob.note
    assert resp_json["info"]["doctype"] == "document"


def test_related_objects(auto_login_user):

    # Quiet spurious output
    settings.NPLUSONE_WHITELIST = [
        {
            "label": "unused_eager_load",
            "model": "blob.BlobToObject"
        }
    ]

    user, client = auto_login_user()

    blob_1 = BlobFactory.create(user=user)
    blob_2 = BlobFactory.create(user=user)

    BlobToObject.objects.create(node=blob_1, blob=blob_2)

    url = urls.reverse("blob:related_objects", kwargs={"uuid": str(blob_1.uuid)})
    resp = client.get(url)

    assert resp.status_code == 200

    payload = resp.json()
    assert payload["status"] == "OK"
    assert len(payload["related_objects"]) == 1
    assert payload["related_objects"][0]["uuid"] == str(blob_2.uuid)


def test_blob_add_related_object(auto_login_user):

    user, client = auto_login_user()

    blob_1 = BlobFactory.create(user=user)
    blob_2 = BlobFactory.create(user=user)

    url = urls.reverse("blob:add_related_object")
    resp = client.post(url, {
        "node_uuid": blob_1.uuid,
        "object_uuid": blob_2.uuid,
        "node_type": "blob"
    })

    assert resp.status_code == 200

    related_blobs = BlobToObject.objects.filter(node=blob_1)
    assert related_blobs.count() == 1
    assert related_blobs.first().blob == blob_2


def test_blob_remove_related_object(auto_login_user):

    user, client = auto_login_user()

    blob_1 = BlobFactory.create(user=user)
    blob_2 = BlobFactory.create(user=user)

    BlobToObject.objects.create(node=blob_1, blob=blob_2)

    url = urls.reverse("blob:remove_related_object")
    resp = client.post(url, {
        "node_uuid": blob_1.uuid,
        "object_uuid": blob_2.uuid,
        "node_type": "blob"
    })

    assert resp.status_code == 200

    related_blobs = BlobToObject.objects.filter(node=blob_1)
    assert related_blobs.count() == 0


def test_blob_update_page_number(auto_login_user):

    user, client = auto_login_user()

    blob = BlobFactory.create(user=user)
    page_number = 2

    url = urls.reverse("blob:update_page_number")

    # Patch out the call to invoke the AWS lambda to update
    #  the blob's thumbnail
    with patch("botocore.client.BaseClient._make_api_call", new=mock):

        resp = client.post(url, {
            "blob_uuid": blob.uuid,
            "page_number": page_number
        })

        assert resp.status_code == 200

    blob_updated = Blob.objects.get(uuid=blob.uuid)
    assert blob_updated.data == {"pdf_page_number": page_number}


def test_blob_update_related_object_note(auto_login_user):

    user, client = auto_login_user()

    blob_1 = BlobFactory.create(user=user)
    blob_2 = BlobFactory.create(user=user)

    BlobToObject.objects.create(node=blob_1, blob=blob_2)

    note = faker.text()

    url = urls.reverse("blob:update_related_object_note")
    resp = client.post(url, {
        "node_uuid": blob_1.uuid,
        "object_uuid": blob_2.uuid,
        "note": note,
        "node_type": "blob"
    })

    assert resp.status_code == 200

    related_object = BlobToObject.objects.get(node=blob_1, blob=blob_2)
    assert related_object.note == note


def test_blob_get_template(auto_login_user):

    user, client = auto_login_user()

    name = faker.text(max_nb_chars=10)
    content = faker.text(max_nb_chars=20)
    tags = ["django"]
    template = {
        "content": content,
        "tags": tags
    }
    obj = BlobTemplate.objects.create(name=name, template=template, user=user)

    url = urls.reverse("blob:get_template") + f"?uuid={obj.uuid}"
    resp = client.get(url)

    assert resp.status_code == 200

    payload = resp.json()
    assert payload["template"]["content"] == content
    assert payload["template"]["tags"] == tags


@patch("blob.services.get_elasticsearch_connection")
def test_bookshelf_list(mock_get_es, auto_login_user):

    user, client = auto_login_user()

    mock_es = MagicMock()
    mock_es.search.return_value = {
        "hits": {
            "total": {"value": 1},
            "hits": [
                {
                    "_score": 1.0,
                    "_source": {
                        "date": {
                            "gte": faker.pyint(min_value=1970, max_value=2020),
                            "lte": faker.pyint(min_value=1970, max_value=2020)
                        },
                        "filename": faker.file_name(extension="pdf"),
                        "name": faker.text(max_nb_chars=20),
                        "tags": [
                            "django"
                        ],
                        "uuid": str(uuid.uuid4()),
                        "size": 1234,
                        "last_modified": "2025-08-01T17:04:23.788834-04:00"
                    },
                    "_id": str(uuid.uuid4()),
                },
            ]
        },
        "aggregations": {"Doctype Filter": {"buckets": []}}
    }
    mock_get_es.return_value = mock_es

    book = BlobFactory.create(user=user)
    _ = MetaData.objects.create(blob=book, user=user, name="is_book", value="true")
    tag = TagFactory(user=user)
    book.tags.add(tag)

    url = urls.reverse("blob:bookshelf")
    resp = client.get(url)

    assert resp.status_code == 200
    assert resp.context["total_count"] == 1
