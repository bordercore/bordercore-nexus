from unittest.mock import MagicMock, patch

import pytest
import requests
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

pytestmark = [pytest.mark.django_db]


@pytest.fixture
def token(auto_login_user):
    """
    Get a DRF authentication token.
    """
    user, _ = auto_login_user()
    return Token.objects.create(user=user)


@pytest.fixture
def client(token):
    """
    Get an authenticated client.
    """
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Token " + token.key)
    return client


def test_missing_url_parameter(client):
    client_unauthenticated = APIClient()

    # Try to access the view without authentication
    response = client_unauthenticated.get("/api/extract_text")
    assert response.status_code == 403  # Unauthorized

    # Try to access the view with authentication
    response = client.get("/api/extract_text")
    assert response.status_code == 400
    assert response.json() == {"error": "URL parameter is required"}


@patch("services.requests.get")
@patch("services.trafilatura.extract")
def test_successful_extraction(mock_extract, mock_requests_get, client):
    mock_response = MagicMock()
    mock_response.text = "Sample HTML content"
    mock_requests_get.return_value = mock_response
    mock_extract.return_value = "Extracted text"

    response = client.get("/api/extract_text", {"url": "http://example.com"})
    assert response.status_code == 200
    assert response.json() == {"text": "Extracted text"}
    mock_requests_get.assert_called_once_with("http://example.com", timeout=10)


@patch("services.requests.get")
@patch("services.trafilatura.extract")
def test_no_text_extracted(mock_extract, mock_requests_get, client):
    mock_response = MagicMock()
    mock_response.text = "Sample HTML content"
    mock_requests_get.return_value = mock_response
    mock_extract.return_value = None

    response = client.get("/api/extract_text", {"url": "http://example.com"})
    assert response.status_code == 422
    assert response.json() == {"error": "No text could be extracted from the given URL"}


@patch("services.requests.get")
def test_request_exception(mock_requests_get, client):
    mock_requests_get.side_effect = requests.RequestException("Connection error")

    response = client.get("/api/extract_text", {"url": "http://example.com"})
    assert response.status_code == 500
    assert response.json() == {"error": "Error fetching URL: Connection error"}


@patch("services.requests.get")
@patch("services.trafilatura.extract")
def test_unexpected_exception(mock_extract, mock_requests_get, client):
    mock_response = MagicMock()
    mock_response.text = "Sample HTML content"
    mock_requests_get.return_value = mock_response
    mock_extract.side_effect = Exception("Unexpected error")

    response = client.get("/api/extract_text", {"url": "http://example.com"})
    assert response.status_code == 500
    assert response.json() == {"error": "An unexpected error occurred: Unexpected error"}
