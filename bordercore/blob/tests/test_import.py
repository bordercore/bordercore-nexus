from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from time import sleep
from unittest.mock import Mock, patch

import pytest
import requests

from django.contrib.auth.models import User
from django.contrib.messages import get_messages
from django.contrib.messages.storage.fallback import FallbackStorage
from django.http import HttpResponse
from django.test import RequestFactory
from django.urls import reverse

from blob.models import Blob
from blob.services import BlobImportError, extract_article_data, import_blob
from blob.views import BlobImportView
from lib.util import UnsafeURLError

URL = "https://example.com/article"


@pytest.fixture
def download():
    with patch("blob.services.fetch_url_safely") as fetch:
        response = requests.Response()
        response.status_code = 200
        response._content = b"<html><body>An article</body></html>"
        fetch.return_value = response
        yield fetch


@pytest.mark.parametrize(
    ("error", "message"),
    [
        (requests.ConnectTimeout("private details"), "took too long"),
        (requests.ReadTimeout("private details"), "took too long"),
        (requests.ConnectionError("private details"), "couldn't download"),
        (requests.HTTPError("private details"), "couldn't download"),
        (UnsafeURLError("private details"), "direct link to a public"),
    ],
)
def test_download_failure_has_actionable_message(download, error, message):
    download.side_effect = error

    with pytest.raises(BlobImportError, match=message) as exc:
        import_blob(User(), URL)

    assert "private details" not in str(exc.value)
    assert download.call_args.kwargs["timeout"] == 3
    assert download.call_args.kwargs["max_redirects"] == 2


def test_article_extraction_preserves_metadata_and_markdown(download):
    with (
        patch("blob.services.bare_extraction", return_value={
            "title": "An article", "author": "An author", "date": "2026-10-20",
        }),
        patch("blob.services.extract", return_value="# An article\n\nContent"),
    ):
        result = import_blob(User(), URL)

    assert result == {
        "success": True, "title": "An article", "author": "An author",
        "date": "2026-10-20", "content": "# An article\n\nContent", "url": URL,
    }


def test_downloaded_bytes_work_with_real_article_extraction(download):
    download.return_value._content = (
        "<html><head><title>A garden in autumn</title></head><body><article>"
        "<h1>A garden in autumn</h1><p>"
        + "The garden changes with the seasons. Leaves cover the paths and "
        "the trees turn gold as the days get shorter. " * 20
        + "</p></article></body></html>"
    ).encode()

    result = extract_article_data(URL)

    assert result["success"] is True
    assert result["title"] == "A garden in autumn"
    assert "The garden changes with the seasons." in result["content"]


def test_empty_download_is_not_imported(download):
    download.return_value._content = b""
    assert extract_article_data(URL)["error"] == (
        "That page is empty. Check the URL or try another page."
    )


def test_page_without_extractable_content(download):
    with (
        patch("blob.services.bare_extraction", return_value=None),
        patch("blob.services.extract", return_value=None),
        patch("blob.services.extract_metadata", return_value=None),
    ):
        result = extract_article_data(URL)
    assert result["success"] is False
    assert "couldn't find article content" in result["error"]


def test_unexpected_extraction_error_is_logged_without_exposing_details(download):
    with (
        patch("blob.services.bare_extraction", side_effect=ValueError("private details")),
        patch("blob.services.log.exception") as log,
    ):
        result = extract_article_data(URL)

    assert result["success"] is False
    assert "private details" not in result["error"]
    assert "try again later" in result["error"]
    log.assert_called_once()


@pytest.fixture
def import_request():
    request = RequestFactory().post(reverse("blob:import"), {"url": URL})
    request.user = User()
    request.session = {}
    request._messages = FallbackStorage(request)
    return request


@pytest.mark.parametrize(
    "error",
    [BlobImportError("That website took too long to respond. Please try again later."),
     RuntimeError("private details"), ValueError("private details")],
)
def test_import_view_redisplays_form_with_safe_error(import_request, error):
    with (
        patch("blob.views.import_blob", side_effect=error),
        patch("blob.views.render", return_value=HttpResponse()) as render,
        patch("blob.views.log.exception") as log,
    ):
        response = BlobImportView.as_view()(import_request)

    assert response.status_code == 200
    render.assert_called_once_with(import_request, "blob/import.html", {})
    assert import_request.POST["url"] == URL
    message = str(list(get_messages(import_request))[0])
    assert "private details" not in message
    assert "try again later" in message
    assert log.call_count == (0 if isinstance(error, BlobImportError) else 1)
    assert "imported_blob_data" not in import_request.session


def test_generic_import_redirects_to_prefilled_create_form(import_request):
    result = {"success": True, "title": "Article", "content": "Content", "url": URL}
    with patch("blob.views.import_blob", return_value=result):
        response = BlobImportView.as_view()(import_request)
    assert response.url == reverse("blob:create")
    assert import_request.session["imported_blob_data"] == result


def test_specialized_import_redirects_to_blob(import_request):
    blob = Blob()
    with patch("blob.views.import_blob", return_value=blob):
        response = BlobImportView.as_view()(import_request)
    assert response.url == reverse("blob:detail", kwargs={"uuid": blob.uuid})


def test_blank_url_does_not_attempt_import(import_request):
    import_request.POST = {"url": "  "}
    with (
        patch("blob.views.import_blob") as importer,
        patch("blob.views.render", return_value=HttpResponse()),
    ):
        BlobImportView.as_view()(import_request)
    importer.assert_not_called()
    assert str(list(get_messages(import_request))[0]) == "URL is required."


@pytest.mark.parametrize("status", [200, 503])
def test_real_download_timeout_and_http_failure_do_not_retry(monkeypatch, status):
    """Exercise the HTTP client, including its actual timeout/retry behavior."""
    calls = Mock()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            calls()
            if status == 200:
                sleep(0.2)  # Longer than the test's read timeout.
            self.send_response(status)
            self.end_headers()

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
    thread.start()
    # Only this test's loopback fixture bypasses the public-host guard.
    monkeypatch.setattr("lib.util._assert_public_host", lambda hostname: None)
    monkeypatch.setattr("blob.services.ARTICLE_DOWNLOAD_TIMEOUT", 0.05)
    try:
        result = extract_article_data(f"http://127.0.0.1:{server.server_port}/article")
    finally:
        server.shutdown()
        server.server_close()
        thread.join()

    assert result["success"] is False
    assert ("took too long" if status == 200 else "couldn't download") in result["error"]
    calls.assert_called_once()
