from unittest.mock import patch
from uuid import uuid4

import pytest

from django import urls
from django.test import RequestFactory

from accounts.tests.factories import UserFactory
from blob.tests.factories import BlobFactory
from collection.tests.factories import CollectionFactory
from homepage import views

pytestmark = [pytest.mark.django_db]

request_factory = RequestFactory()


@pytest.fixture
def monkeypatch_homepage(monkeypatch):
    """Prevent the homepage view from interacting with Elasticsearch."""

    def mock(*args, **kwargs):
        pass

    monkeypatch.setattr(views, "get_random_image", mock)


def test_homepage(monkeypatch_homepage, authenticated_client, bookmark, question, todo):
    """Test the homepage renders successfully with all fixtures."""
    _, client = authenticated_client()

    url = urls.reverse("homepage:homepage")
    resp = client.get(url)

    assert resp.status_code == 200


def test_get_random_image(monkeypatch_collection, authenticated_client):
    """Test get_random_image returns image from user's collection."""
    user, client = authenticated_client()

    collection = CollectionFactory(user=user)
    blob = BlobFactory(user=user, file="test.jpg")
    collection.add_object(blob)
    user.userprofile.homepage_image_collection = collection
    user.userprofile.save()

    image = views.get_random_image(user)

    assert image["name"] == blob.name
    assert image["uuid"] == blob.uuid


def test_get_random_image_filters_content_type(monkeypatch_collection, authenticated_client):
    """Test get_random_image filters by content_type in collection path."""
    user, client = authenticated_client()

    collection = CollectionFactory(user=user)
    pdf_blob = BlobFactory(user=user, file="document.pdf")
    image_blob = BlobFactory(user=user, file="photo.jpeg")
    collection.add_object(pdf_blob)
    collection.add_object(image_blob)
    user.userprofile.homepage_image_collection = collection
    user.userprofile.save()

    image = views.get_random_image(user, content_type="image/*")

    assert image is not None
    assert image["uuid"] == image_blob.uuid


def test_get_random_image_no_collection(authenticated_client, mock_elasticsearch):
    """Test get_random_image falls back to Elasticsearch when no collection set."""
    user, client = authenticated_client()

    mock_elasticsearch.search.return_value = {
        "hits": {"hits": [{"_source": {"filename": "test.jpg", "name": "Test", "uuid": str(uuid4())}}]}
    }

    image = views.get_random_image(user, content_type="image/*")

    assert image is not None
    assert image["name"] == "Test"


def test_get_random_image_no_results(authenticated_client, mock_elasticsearch):
    """Test get_random_image returns None when no images found."""
    user, client = authenticated_client()

    mock_elasticsearch.search.return_value = {"hits": {"hits": []}}

    image = views.get_random_image(user, content_type="image/*")

    assert image is None


def test_sql(authenticated_client):
    """Test SQL browser page with valid blob UUID."""
    user, client = authenticated_client()

    blob = BlobFactory(user=user)

    url = urls.reverse("homepage:sql")
    resp = client.get(f"{url}?sql_db_uuid={blob.uuid}")

    assert resp.context["sql_db_url"] == urls.reverse("blob:file", kwargs={"uuid": blob.uuid})
    assert resp.status_code == 200


def test_sql_nonexistent_uuid(authenticated_client):
    """Test SQL browser page with a UUID that doesn't exist."""
    _, client = authenticated_client()

    url = urls.reverse("homepage:sql")
    resp = client.get(f"{url}?sql_db_uuid={uuid4()}")

    assert resp.status_code == 200
    assert "sql_db_url" not in resp.context


def test_sql_invalid_uuid(authenticated_client):
    """Test SQL browser page with an invalid UUID string."""
    _, client = authenticated_client()

    url = urls.reverse("homepage:sql")
    resp = client.get(f"{url}?sql_db_uuid=not-a-valid-uuid")

    assert resp.status_code == 200
    assert "sql_db_url" not in resp.context


def test_sql_other_users_blob(authenticated_client):
    """Test SQL browser page rejects a blob belonging to another user."""
    _, client = authenticated_client()

    other_user = UserFactory(username="otheruser")
    blob = BlobFactory(user=other_user)

    url = urls.reverse("homepage:sql")
    resp = client.get(f"{url}?sql_db_uuid={blob.uuid}")

    assert resp.status_code == 200
    assert "sql_db_url" not in resp.context


def test_get_default_collection_blobs_no_collection(authenticated_client):
    """Test get_default_collection_blobs returns empty dict when no collection set."""
    user, _ = authenticated_client()

    result = views.get_default_collection_blobs(user)

    assert result == {}


def test_get_default_collection_blobs_with_collection(monkeypatch_collection, authenticated_client):
    """Test get_default_collection_blobs returns collection info."""
    user, _ = authenticated_client()

    collection = CollectionFactory(user=user, name="My Collection")
    blob = BlobFactory(user=user)
    collection.add_object(blob)
    user.userprofile.homepage_default_collection = collection
    user.userprofile.save()

    result = views.get_default_collection_blobs(user)

    assert result["uuid"] == collection.uuid
    assert result["name"] == "My Collection"
    assert "blob_list" in result


def test_get_calendar_events_no_credentials(authenticated_client):
    """Test calendar events endpoint returns empty list without credentials."""
    _, client = authenticated_client()

    url = urls.reverse("homepage:get_calendar_events")
    resp = client.get(url)

    assert resp.status_code == 200
    assert resp.json() == []


def test_get_calendar_events_with_credentials(authenticated_client):
    """Test calendar events endpoint returns events when credentials exist."""
    _, client = authenticated_client()

    mock_events = [{"summary": "Meeting", "start_raw": "2026-03-07T10:00:00"}]

    with patch("homepage.views.Calendar") as MockCalendar:
        instance = MockCalendar.return_value
        instance.has_credentials.return_value = True
        instance.get_calendar_info.return_value = mock_events

        url = urls.reverse("homepage:get_calendar_events")
        resp = client.get(url)

    assert resp.status_code == 200
    assert resp.json() == mock_events


def test_handler404(authenticated_client):
    """Test 404 error handler returns correct status code."""
    _, client = authenticated_client()
    response = client.get("/nonexistent-page-that-does-not-exist/")

    assert response.status_code == 404


def test_handler403(authenticated_client):
    """Test 403 error handler returns correct status code."""
    request = request_factory.get("/forbidden")
    request.user = authenticated_client()[0]
    response = views.handler403(request)

    assert response.status_code == 403


def test_handler500(authenticated_client):
    """Test 500 error handler returns correct status code."""
    request = request_factory.get("/error")
    request.user = authenticated_client()[0]
    response = views.handler500(request)

    assert response.status_code == 500
