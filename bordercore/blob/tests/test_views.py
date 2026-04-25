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


def test_blob_list(authenticated_client, blob_text_factory):
    """Test that the blob list view returns 200."""

    _, client = authenticated_client()

    # The empty form
    url = urls.reverse("blob:list")
    resp = client.get(url)

    assert resp.status_code == 200


@factory.django.mute_signals(signals.post_save)
def test_blob_create(monkeypatch_blob, authenticated_client, blob_text_factory):
    """Test blob creation via form submission, linked blobs, and file upload."""

    _, client = authenticated_client()

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
    blob_uuid = payload["uuid"]
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
def test_blob_delete(monkeypatch_blob, authenticated_client, blob_text_factory):
    """Test that deleting a blob removes it from the database."""

    # Quiet spurious output
    settings.NPLUSONE_WHITELIST = [
        {
            "label": "unused_eager_load",
            "model": "blob.Blob"
        }
    ]

    _, client = authenticated_client()
    url = urls.reverse("blob-detail", kwargs={"uuid": blob_text_factory[0].uuid})
    resp = client.delete(url)

    assert resp.status_code == 204
    assert not Blob.objects.filter(uuid=blob_text_factory[0].uuid).exists()


@factory.django.mute_signals(signals.post_save)
def test_blob_update(monkeypatch_blob, authenticated_client, blob_text_factory, blob_pdf_factory):
    """Test blob update including file change and filename rename."""

    _, client = authenticated_client()

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
def test_blob_detail(authenticated_client, resolved_blob):
    """Test blob detail view renders for both image and text blobs."""

    _, client = authenticated_client()

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


def test_clone(monkeypatch_blob, authenticated_client):
    """Test that cloning a blob redirects to the new blob's detail page."""

    user, client = authenticated_client()

    blob = BlobFactory.create(user=user)

    url = urls.reverse("blob:clone", kwargs={"uuid": str(blob.uuid)})
    resp = client.get(url)

    assert resp.status_code == 302


def test_handle_metadata(authenticated_client, blob_text_factory, blob_image_factory):
    """Test that handle_metadata creates and replaces metadata entries."""

    user, client = authenticated_client()

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


def test_handle_linked_collection(monkeypatch_collection, authenticated_client, blob_image_factory):
    """Test that handle_linked_collection adds a blob to a collection."""

    user, client = authenticated_client()

    collection = CollectionFactory(user=user)

    request_mock = Mock()
    request_mock.user = user
    request_mock.POST = {
        "linked_collection": collection.uuid
    }

    handle_linked_collection(blob_image_factory[0], request_mock)

    collection_updated = Collection.objects.get(uuid=collection.uuid)

    assert blob_image_factory[0] in [x.blob for x in collection_updated.collectionobject_set.all()]


def test_blob_metadata_name_search(authenticated_client, blob_image_factory):
    """Test that metadata name search returns 200."""

    _, client = authenticated_client()

    url = urls.reverse("blob:metadata_name_search")
    resp = client.get(f"{url}?query=foobar")

    assert resp.status_code == 200


def test_blob_parse_date(authenticated_client):
    """Test date parsing for valid and invalid date strings."""

    _, client = authenticated_client()

    url = urls.reverse("blob:parse_date", kwargs={"input_date": "2021-01-01"})
    resp = client.get(url)
    assert resp.json() == {'output_date': '2021-01-01T00:00', 'message': None}
    assert resp.status_code == 200

    # Test a bogus date
    url = urls.reverse("blob:parse_date", kwargs={"input_date": "2021-01-34"})
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.json() == {'output_date': '', 'message': "time data '01/34/2021' does not match format '%m/%d/%Y'"}


def test_blob_update_cover_image(s3_resource, s3_bucket, authenticated_client):
    """Test updating a blob's cover image via the API."""

    user, client = authenticated_client()

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


@patch("blob.models.Blob.get_elasticsearch_info")
def test_get_elasticsearch_info(mock_get_info, authenticated_client):
    """Test blob:get_elasticsearch_info while mocking the ES query."""

    user, client = authenticated_client()
    blob = BlobFactory.create(user=user, tags=("django", "linux"))

    # First request: simulate no result
    mock_get_info.return_value = {}

    url = urls.reverse("blob:get_elasticsearch_info", kwargs={"uuid": blob.uuid})
    resp = client.get(url)

    assert resp.status_code == 200
    assert resp.json() == {"info": {}}

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
    assert resp_json["info"]["id"] == str(blob.uuid)
    assert resp_json["info"]["name"] == blob.name
    assert resp_json["info"]["filename"] == ""
    assert resp_json["info"]["note"] == blob.note
    assert resp_json["info"]["doctype"] == "document"


def test_related_objects(authenticated_client):
    """Test that related objects are returned for a blob."""

    # Quiet spurious output
    settings.NPLUSONE_WHITELIST = [
        {
            "label": "unused_eager_load",
            "model": "blob.BlobToObject"
        }
    ]

    user, client = authenticated_client()

    blob_1 = BlobFactory.create(user=user)
    blob_2 = BlobFactory.create(user=user)

    BlobToObject.objects.create(node=blob_1, blob=blob_2)

    url = urls.reverse("blob:related_objects", kwargs={"uuid": str(blob_1.uuid)})
    resp = client.get(url)

    assert resp.status_code == 200

    payload = resp.json()
    assert len(payload["related_objects"]) == 1
    assert payload["related_objects"][0]["uuid"] == str(blob_2.uuid)


def test_blob_add_related_object(authenticated_client):
    """Test adding a related object to a blob."""

    user, client = authenticated_client()

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


def test_blob_remove_related_object(authenticated_client):
    """Test removing a related object from a blob."""

    user, client = authenticated_client()

    blob_1 = BlobFactory.create(user=user)
    blob_2 = BlobFactory.create(user=user)

    BlobToObject.objects.create(node=blob_1, blob=blob_2)

    url = urls.reverse("blob:remove_related_object")
    resp = client.post(url, {
        "node_uuid": blob_1.uuid,
        "object_uuid": blob_2.uuid,
        "node_type": "blob"
    })

    assert resp.status_code == 204

    related_blobs = BlobToObject.objects.filter(node=blob_1)
    assert related_blobs.count() == 0


def test_blob_update_page_number(authenticated_client):
    """Test updating the PDF page number for cover image generation."""

    user, client = authenticated_client()

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


def test_blob_update_related_object_note(authenticated_client):
    """Test updating the note on a related object."""

    user, client = authenticated_client()

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


def test_blob_get_template(authenticated_client):
    """Test retrieving a blob template by UUID."""

    user, client = authenticated_client()

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
def test_bookshelf_list(mock_get_es, authenticated_client):

    user, client = authenticated_client()

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


def test_blob_file_serve(s3_resource, s3_bucket, authenticated_client):
    """Test serving a blob's file returns the file content."""

    user, client = authenticated_client()
    blob = BlobFactory.create(user=user)

    # Upload a file to S3 for this blob
    file_contents = b"test file contents"
    blob_file = io.BytesIO(file_contents)
    blob_file.name = "test_file.txt"
    blob.file_modified = 1638644921
    blob.file.save(blob_file.name, blob_file)
    blob.save()

    url = urls.reverse("blob:file", kwargs={"uuid": blob.uuid})
    resp = client.get(url)

    assert resp.status_code == 200
    assert resp["Content-Disposition"] == 'attachment; filename="test_file.txt"'


def test_blob_file_serve_no_file(authenticated_client):
    """Test serving a blob without a file returns 404."""

    user, client = authenticated_client()
    blob = BlobFactory.create(user=user)

    url = urls.reverse("blob:file", kwargs={"uuid": blob.uuid})
    resp = client.get(url)

    assert resp.status_code == 404


def test_blob_file_serve_other_user(authenticated_client):
    """Test that a user cannot serve another user's blob file."""

    from accounts.tests.factories import UserFactory

    other_user = UserFactory()
    blob = BlobFactory.create(user=other_user)

    # Log in after creating the other user's blob to avoid session issues
    _, client = authenticated_client()

    url = urls.reverse("blob:file", kwargs={"uuid": blob.uuid})
    resp = client.get(url)

    assert resp.status_code == 404


def test_blob_file_serve_nonexistent(authenticated_client):
    """Test serving a nonexistent blob UUID returns 404."""

    _, client = authenticated_client()

    url = urls.reverse("blob:file", kwargs={"uuid": uuid.uuid4()})
    resp = client.get(url)

    assert resp.status_code == 404


@patch("blob.views.chatbot")
def test_chat(mock_chatbot, authenticated_client):
    """Test that the chat endpoint returns a streaming response."""

    def fake_generator():
        yield "Hello "
        yield "world"

    mock_chatbot.return_value = fake_generator()

    _, client = authenticated_client()

    url = urls.reverse("blob:chat")
    resp = client.post(url, {"chat_history": "[]", "mode": "general"})

    assert resp.status_code == 200
    assert resp["Content-Type"] == "text/plain"
    content = b"".join(resp.streaming_content).decode()
    assert content == "Hello world"


def test_sort_related_objects(authenticated_client):
    """Test sorting related objects changes their order."""

    user, client = authenticated_client()

    blob_1 = BlobFactory.create(user=user)
    blob_2 = BlobFactory.create(user=user)
    blob_3 = BlobFactory.create(user=user)

    BlobToObject.objects.create(node=blob_1, blob=blob_2)
    BlobToObject.objects.create(node=blob_1, blob=blob_3)

    url = urls.reverse("blob:sort_related_objects")
    resp = client.post(url, {
        "node_uuid": blob_1.uuid,
        "object_uuid": blob_3.uuid,
        "new_position": 0,
        "node_type": "blob"
    })

    assert resp.status_code == 200


@patch("blob.views.chatbot_followups")
def test_chat_followups_returns_suggestions(mock_followups, authenticated_client):
    """chat_followups view returns suggestions as JSON."""
    mock_followups.return_value = ["a", "b", "c"]

    _, client = authenticated_client()
    url = urls.reverse("blob:chat_followups")
    resp = client.post(
        url,
        data=json.dumps({"assistant_reply": "Hello", "mode": "chat"}),
        content_type="application/json",
    )

    assert resp.status_code == 200
    assert resp.json() == {"suggestions": ["a", "b", "c"]}
    mock_followups.assert_called_once_with("Hello", mode="chat")


def test_chat_followups_requires_login(client):
    """chat_followups view returns 403 for unauthenticated requests."""
    url = urls.reverse("blob:chat_followups")
    resp = client.post(
        url,
        data=json.dumps({"assistant_reply": "x", "mode": "chat"}),
        content_type="application/json",
    )
    assert resp.status_code == 403


@patch("blob.views.chatbot_followups")
def test_chat_followups_handles_missing_fields(mock_followups, authenticated_client):
    """chat_followups view tolerates missing fields by defaulting them."""
    mock_followups.return_value = []

    _, client = authenticated_client()
    url = urls.reverse("blob:chat_followups")
    resp = client.post(url, data=json.dumps({}), content_type="application/json")

    assert resp.status_code == 200
    assert resp.json() == {"suggestions": []}
    mock_followups.assert_called_once_with("", mode="chat")


def test_chat_save_as_note_creates_note(authenticated_client):
    """chat_save_as_note creates a note-typed Blob and returns its uuid + url."""
    user, client = authenticated_client()
    url = urls.reverse("blob:chat_save_as_note")
    resp = client.post(
        url,
        data=json.dumps({
            "title": "My answer",
            "tags": "ai, chatbot",
            "content": "The answer is 42.",
        }),
        content_type="application/json",
    )

    assert resp.status_code == 200
    body = resp.json()
    assert "uuid" in body
    assert "url" in body

    from blob.models import Blob
    blob = Blob.objects.get(uuid=body["uuid"])
    assert blob.user_id == user.id
    assert blob.is_note is True
    assert blob.name == "My answer"
    assert blob.content == "The answer is 42."
    tag_names = sorted(t.name for t in blob.tags.all())
    assert tag_names == ["ai", "chatbot"]


def test_chat_save_as_note_requires_title(authenticated_client):
    """chat_save_as_note returns 400 when title is missing or blank."""
    _, client = authenticated_client()
    url = urls.reverse("blob:chat_save_as_note")

    resp = client.post(
        url,
        data=json.dumps({"title": "  ", "content": "x"}),
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_chat_save_as_note_requires_login(client):
    """chat_save_as_note returns 403 for unauthenticated requests."""
    url = urls.reverse("blob:chat_save_as_note")
    resp = client.post(
        url,
        data=json.dumps({"title": "x", "content": "y"}),
        content_type="application/json",
    )
    assert resp.status_code == 403
