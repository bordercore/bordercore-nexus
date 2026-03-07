from unittest.mock import patch, MagicMock

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from accounts.tests.factories import TEST_USERNAME

pytestmark = [pytest.mark.django_db]


@patch.dict("os.environ", {"WEATHER_API_KEY": ""}, clear=False)
def test_fetch_weather_missing_api_key(authenticated_client):
    authenticated_client()
    with pytest.raises(CommandError, match="WEATHER_API_KEY"):
        call_command("fetch_weather", TEST_USERNAME)


@patch.dict("os.environ", {"WEATHER_API_KEY": "test-key"})
@patch("accounts.management.commands.fetch_weather.requests.get")
def test_fetch_weather_success(mock_get, authenticated_client):
    authenticated_client()
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "location": {"name": "Cambridge"},
        "current": {"temp_f": 72},
        "forecast": {"should": "be removed"},
    }
    mock_response.raise_for_status = MagicMock()
    mock_get.return_value = mock_response

    call_command("fetch_weather", TEST_USERNAME)

    from django.contrib.auth.models import User
    user = User.objects.get(username=TEST_USERNAME)
    assert user.userprofile.weather["location"]["name"] == "Cambridge"
    assert "forecast" not in user.userprofile.weather


@patch.dict("os.environ", {"WEATHER_API_KEY": "test-key"})
def test_fetch_weather_nonexistent_user(authenticated_client):
    authenticated_client()
    with pytest.raises(CommandError, match="does not exist"):
        call_command("fetch_weather", "nonexistent_user")


@patch.dict("os.environ", {"WEATHER_API_KEY": "test-key"})
@patch("accounts.management.commands.fetch_weather.requests.get")
def test_fetch_weather_api_failure(mock_get, authenticated_client):
    import requests
    authenticated_client()
    mock_get.side_effect = requests.exceptions.ConnectionError("timeout")

    with pytest.raises(CommandError, match="Failed to fetch"):
        call_command("fetch_weather", TEST_USERNAME)


@patch.dict("os.environ", {"WEATHER_API_KEY": "test-key"})
@patch("accounts.management.commands.fetch_weather.requests.get")
def test_fetch_weather_uses_https(mock_get, authenticated_client):
    authenticated_client()
    mock_response = MagicMock()
    mock_response.json.return_value = {"current": {"temp_f": 72}}
    mock_response.raise_for_status = MagicMock()
    mock_get.return_value = mock_response

    call_command("fetch_weather", TEST_USERNAME)

    called_url = mock_get.call_args[0][0]
    assert called_url.startswith("https://")
