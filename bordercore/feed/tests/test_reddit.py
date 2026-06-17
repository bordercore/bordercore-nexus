"""Unit tests for Reddit OAuth fetching and listing parsing."""
import pytest
import requests
import responses

from feed.reddit import RedditAuthError, RedditClient
from lib.constants import REDDIT_OAUTH_TOKEN_URL

FEED_UA = "python:com.bordercore.feedreader:v1.0 (by jerrell@bordercore.com)"


def _add_token(access_token="tok", status=200):
    responses.add(
        responses.POST, REDDIT_OAUTH_TOKEN_URL,
        json={"access_token": access_token, "expires_in": 3600}, status=status,
    )


@responses.activate
def test_token_fetched_once_and_reused():
    _add_token()
    responses.add(responses.GET, "https://oauth.reddit.com/r/a/new", json={"data": {"children": []}})
    responses.add(responses.GET, "https://oauth.reddit.com/r/b/new", json={"data": {"children": []}})

    client = RedditClient("id", "secret")
    client.get("/r/a/new")
    client.get("/r/b/new")

    token_calls = [c for c in responses.calls if c.request.url == REDDIT_OAUTH_TOKEN_URL]
    assert len(token_calls) == 1


@responses.activate
def test_token_request_uses_basic_auth_and_user_agent():
    _add_token()
    responses.add(responses.GET, "https://oauth.reddit.com/r/a/new", json={"data": {"children": []}})

    RedditClient("myid", "mysecret").get("/r/a/new")

    token_req = next(c.request for c in responses.calls if c.request.url == REDDIT_OAUTH_TOKEN_URL)
    assert token_req.headers["Authorization"].startswith("Basic ")
    assert token_req.headers["user-agent"] == FEED_UA
    assert "grant_type=client_credentials" in token_req.body


@responses.activate
def test_get_sends_bearer_token_to_oauth_host():
    _add_token(access_token="abc123")
    responses.add(responses.GET, "https://oauth.reddit.com/r/a/new", json={"data": {"children": []}})

    RedditClient("id", "secret").get("/r/a/new")

    get_req = next(c.request for c in responses.calls if "oauth.reddit.com" in c.request.url)
    assert get_req.headers["Authorization"] == "bearer abc123"
    assert get_req.headers["user-agent"] == FEED_UA


@responses.activate
def test_token_fetch_failure_raises_reddit_auth_error():
    _add_token(status=401)
    with pytest.raises(RedditAuthError):
        RedditClient("id", "secret").get("/r/a/new")


@responses.activate
def test_get_reauths_once_on_401():
    responses.add(responses.POST, REDDIT_OAUTH_TOKEN_URL, json={"access_token": "old"})
    responses.add(responses.GET, "https://oauth.reddit.com/r/a/new", status=401)
    responses.add(responses.POST, REDDIT_OAUTH_TOKEN_URL, json={"access_token": "new"})
    responses.add(responses.GET, "https://oauth.reddit.com/r/a/new", json={"data": {"children": []}}, status=200)

    resp = RedditClient("id", "secret").get("/r/a/new")

    assert resp.status_code == 200
    token_calls = [c for c in responses.calls if c.request.url == REDDIT_OAUTH_TOKEN_URL]
    assert len(token_calls) == 2


@responses.activate
def test_get_retries_on_429_then_succeeds():
    _add_token()
    responses.add(responses.GET, "https://oauth.reddit.com/r/a/new", status=429, headers={"Retry-After": "1"})
    responses.add(responses.GET, "https://oauth.reddit.com/r/a/new", json={"data": {"children": []}}, status=200)

    slept = []
    resp = RedditClient("id", "secret", sleep=slept.append).get("/r/a/new")

    assert resp.status_code == 200
    assert slept == [1.0]  # honored Retry-After via _retry_delay
