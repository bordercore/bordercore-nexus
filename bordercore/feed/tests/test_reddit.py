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


from feed.reddit import _listing_path, fetch_reddit_items

pytestmark_db = pytest.mark.django_db


class _FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code != 200:
            raise requests.HTTPError(f"HTTP {self.status_code}", response=self)


class _FakeClient:
    def __init__(self, payload, status=200):
        self._resp = _FakeResponse(payload, status)
        self.requested = []

    def get(self, path):
        self.requested.append(path)
        return self._resp


def test_listing_path_derives_new_endpoint():
    assert _listing_path("https://www.reddit.com/r/Python/.rss") == "/r/Python/new?limit=25"


@pytest.mark.django_db
def test_fetch_reddit_items_maps_fields(feed):
    feed[0].url = "https://www.reddit.com/r/p/.rss"
    payload = {"data": {"children": [
        {"data": {
            "title": "Hello &amp; World",
            "permalink": "/r/p/comments/1/hello/",
            "created_utc": 1700000000,
            "selftext": "body  text",
            "thumbnail": "https://thumb/x.jpg",
        }},
    ]}}

    items, status = fetch_reddit_items(feed[0], _FakeClient(payload))

    assert status == 200
    assert len(items) == 1
    it = items[0]
    assert it.title == "Hello & World"
    assert it.link == "https://www.reddit.com/r/p/comments/1/hello/"
    assert it.thumbnail_url == "https://thumb/x.jpg"
    assert it.summary == "body text"
    assert it.pub_date.year == 2023


@pytest.mark.django_db
def test_fetch_reddit_items_dedups_links(feed):
    feed[0].url = "https://www.reddit.com/r/p/.rss"
    child = {"data": {"title": "t", "permalink": "/r/p/comments/1/x/", "created_utc": 1700000000}}
    items, _ = fetch_reddit_items(feed[0], _FakeClient({"data": {"children": [child, child]}}))
    assert len(items) == 1


@pytest.mark.django_db
def test_fetch_reddit_items_skips_child_without_permalink(feed):
    feed[0].url = "https://www.reddit.com/r/p/.rss"
    payload = {"data": {"children": [
        {"data": {"title": "no link"}},
        {"data": {"title": "ok", "permalink": "/r/p/comments/2/y/", "created_utc": 1700000000}},
    ]}}
    items, _ = fetch_reddit_items(feed[0], _FakeClient(payload))
    assert len(items) == 1
    assert items[0].link == "https://www.reddit.com/r/p/comments/2/y/"


@pytest.mark.django_db
def test_fetch_reddit_items_raises_on_non_200(feed):
    feed[0].url = "https://www.reddit.com/r/p/.rss"
    with pytest.raises(requests.HTTPError):
        fetch_reddit_items(feed[0], _FakeClient({}, status=503))


@pytest.mark.django_db
def test_fetch_reddit_items_link_post_thumbnail_from_preview(feed):
    feed[0].url = "https://www.reddit.com/r/p/.rss"
    payload = {"data": {"children": [
        {"data": {
            "title": "link post",
            "permalink": "/r/p/comments/3/z/",
            "created_utc": 1700000000,
            "thumbnail": "default",  # not a URL
            "preview": {"images": [{"source": {"url": "https://prev/i.jpg?s=a&amp;t=b"}}]},
        }},
    ]}}
    items, _ = fetch_reddit_items(feed[0], _FakeClient(payload))
    assert items[0].thumbnail_url == "https://prev/i.jpg?s=a&t=b"
