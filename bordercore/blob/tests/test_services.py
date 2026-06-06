import json
import os
import urllib.request
import uuid
from unittest.mock import MagicMock, Mock, patch
from urllib.parse import urlparse

import pytest
from faker import Factory as FakerFactory
from instaloader.instaloader import Instaloader

pytestmark = [pytest.mark.django_db]

from blob.models import Blob
from blob.services import (_build_notes_rag_messages,
                           _rewrite_notes_search_query, chatbot, chatbot_followups,
                           get_authors, get_blob_naturalsize, get_dashboard_blobs,
                           get_recent_blobs, get_recent_media, import_artstation,
                           import_instagram, import_newyorktimes, parse_date,
                           parse_shortcode)
from blob.tests.factories import BlobFactory

faker = FakerFactory.create()


@patch("blob.services.get_blob_sizes")
def test_get_recent_blobs(mock_get_blob_sizes, authenticated_client, blob_image_factory, blob_text_factory):
    """Test recent blobs retrieval with doctype counts."""

    user, _ = authenticated_client()

    mock_get_blob_sizes.return_value = {
        blob_image_factory[0].uuid: {
            "size": faker.random_int(min=1024, max=(1024 * 1024 - 1)),
            "uuid": blob_image_factory[0].uuid
        },
        blob_text_factory[0].uuid: {
            "size": faker.random_int(min=1024, max=(1024 * 1024 - 1)),
            "uuid": blob_text_factory[0].uuid
        }
    }

    blob_list, doctypes = get_recent_blobs(user)

    assert doctypes["image"] == 1
    assert doctypes["document"] == 3
    assert doctypes["all"] == 4

    assert blob_image_factory[0].name in [
        x["name"]
        for x in
        blob_list
    ]

    assert blob_text_factory[0].name in [
        x["name"]
        for x in
        blob_list
    ]


@patch("blob.services.get_blob_sizes")
def test_get_dashboard_blobs(mock_get_blob_sizes, authenticated_client, blob_image_factory, blob_text_factory):
    """The dashboard payload exposes blobs plus rail aggregates."""

    user, _ = authenticated_client()
    mock_get_blob_sizes.return_value = {}

    payload = get_dashboard_blobs(user)

    assert payload["total_count"] == 4
    assert payload["doctype_counts"]["all"] == 4
    assert payload["doctype_counts"]["image"] == 1
    assert payload["doctype_counts"]["document"] == 3
    assert set(payload["date_bucket_counts"].keys()) == {
        "today", "this-week", "last-week", "this-month", "older",
    }
    names = {b["name"] for b in payload["blobs"]}
    assert blob_image_factory[0].name in names
    assert blob_text_factory[0].name in names
    # Each blob carries the fields the cards consume.
    sample = payload["blobs"][0]
    for key in ("uuid", "name", "url", "doctype", "tags", "bucket",
                "is_starred", "is_pinned", "back_refs"):
        assert key in sample


def test_get_recent_media(authenticated_client, blob_image_factory, blob_text_factory):
    """Test recent media retrieval filters to images and videos only."""

    user, _ = authenticated_client()

    media_list = get_recent_media(user)

    assert len(media_list) == 1

    assert blob_image_factory[0].name in [
        x["name"]
        for x in
        media_list
    ]

    assert blob_text_factory[0].name not in [
        x["name"]
        for x in
        media_list
    ]


def test_get_blob_naturalizesize():
    """Test humanized file size formatting."""

    blob_uuid = str(uuid.uuid4)
    blob = {
        "uuid": blob_uuid
    }

    blob_sizes = {
        blob_uuid: {
            "size": 66666
        }
    }

    get_blob_naturalsize(blob_sizes, blob)
    assert blob["content_size"] == "66.7 kB"


class MockInstaloaderPostResponse:

    def __init__(self, url, shortcode):
        self.url = url
        self.shortcode = shortcode
        self.date_utc = None
        self.date = faker.date()
        self.caption = faker.text()
        self.owner_profile = Mock()
        self.owner_profile.full_name = faker.language_name()


def test_import_instagram(s3_resource, s3_bucket, authenticated_client, monkeypatch):
    """Test Instagram import creates blob with correct metadata."""

    shortcode = "CUA4IQcARX2"
    url = f"https://www.instagram.com/p/{shortcode}/"

    def mock(*args, **kwargs):
        pass

    def mock_getmtime(*args, **kwargs):
        return faker.unix_time()

    user, _ = authenticated_client()

    mock_post = MockInstaloaderPostResponse(url=url, shortcode=shortcode)

    monkeypatch.setattr(Blob, "index_blob", mock)
    monkeypatch.setattr(Instaloader, "login", mock)
    monkeypatch.setattr(Instaloader, "download_pic", mock)
    monkeypatch.setattr(os, "rename", mock)
    monkeypatch.setattr(os.path, "getmtime", mock_getmtime)

    with MagicMock().patch("__builtin__.open") as my_mock, patch("instaloader.Post.from_shortcode") as mock_from_shortcode:
        mock_from_shortcode.return_value = mock_post
        my_mock.return_value.__enter__ = lambda s: s
        my_mock.return_value.__exit__ = Mock()
        my_mock.return_value.read.return_value = faker.text()
        blob = import_instagram(user, urlparse(url))

        assert blob.user == user
        assert blob.date == mock_post.date
        assert blob.name == mock_post.caption
        assert blob.metadata.get(name="Url").value == f"https://instagram.com/p/{shortcode}/"
        assert blob.metadata.get(name="Artist").value == mock_post.owner_profile.full_name


@patch("requests.get")
@patch("blob.services.get_sha1sum")
def test_import_artstation(mock_get_sha1sum, mock_requests, s3_resource, s3_bucket, authenticated_client, monkeypatch):
    """Test ArtStation import creates blob with correct metadata."""

    shortcode = "QnxsqB"
    url = f"https://www.artstation.com/artwork/{shortcode}/"

    def mock(*args, **kwargs):
        pass

    artstation_json = {
        "created_at": "2022-01-07T17:46:42.111-06:00",
        "assets": [
            {
                "image_url": "https://cdnb.artstation.com/p/assets/images/images/044/970/399/large/krystopher-decker-lara-final-da.jpg?1641599195"
            }
        ],
        "title": faker.text(),
        "permalink": faker.url(),
        "user": {
            "full_name": faker.language_name()
        }
    }

    user, _ = authenticated_client()

    mock_requests.return_value.json.return_value = artstation_json

    monkeypatch.setattr(urllib.request, "urlretrieve", mock)
    monkeypatch.setattr(Blob, "index_blob", mock)

    # TODO: mock NamedTemporaryFile() to prevent a temp file from being created
    # mock_temp_file = MockNamedTemporaryFile()
    # NamedTemporaryFile = mock_temp_file
    mock_get_sha1sum.return_value = faker.sha1()

    with MagicMock().patch("__builtin__.open") as my_mock:
        my_mock.return_value.__enter__ = lambda s: s
        my_mock.return_value.__exit__ = Mock()
        my_mock.return_value.read.return_value = faker.text()

        blob = import_artstation(user, urlparse(url))

        assert blob.user == user
        assert blob.date == "2022-01-07"
        assert blob.name == artstation_json["title"]
        assert blob.metadata.get(name="Url").value == artstation_json["permalink"]
        assert blob.metadata.get(name="Artist").value == artstation_json["user"]["full_name"]


@pytest.mark.parametrize("byline,expected", [
    ("By Michael D. Shear, Aaron Boxerman and Adam Rasgon",
     ["Michael D. Shear", "Aaron Boxerman", "Adam Rasgon"]),

    ("Michael D. Shear, Aaron Boxerman and Adam Rasgon",
     ["Michael D. Shear", "Aaron Boxerman", "Adam Rasgon"]),

    ("By Michael D. Shear and Aaron Boxerman",
     ["Michael D. Shear", "Aaron Boxerman"]),

    ("By Michael D. Shear",
     ["Michael D. Shear"]),

    ("By Alice Smith, Bob Jones, and Charlie Day",
     ["Alice Smith", "Bob Jones", "Charlie Day"]),

    ("Alice Smith",
     ["Alice Smith"]),

    ("",
     []),

    ("By  Alice Smith ,  Bob Jones and  Charlie Day ",
     ["Alice Smith", "Bob Jones", "Charlie Day"])
])
def test_get_authors(byline, expected):
    assert get_authors(byline) == expected


@patch("requests.get")
def test_import_newyorktimes(mock_requests, authenticated_client, monkeypatch):
    """Test New York Times import creates blob with correct metadata."""

    user, _ = authenticated_client()

    url = faker.url()
    title = faker.text()

    author = f"{faker.first_name()} {faker.last_name()}"
    newyorktimes_json = {
        "status": "OK",
        "response": {
            "docs": [
                {
                    "headline": {
                        "main": title,
                    },
                    "abstract": faker.text(),
                    "web_url": url,
                    "pub_date": "2022-01-15T14:20:32+0000",
                    "byline": {
                        "original": f"By {author}"
                    }
                }
            ]
        }
    }

    def mock(*args, **kwargs):
        pass

    mock_requests.return_value.json.return_value = newyorktimes_json
    monkeypatch.setattr(Blob, "index_blob", mock)

    blob = import_newyorktimes(user, url)

    assert blob.user == user
    assert blob.date == "2022-01-15"
    assert blob.name == title
    assert blob.metadata.get(name="Url").value == newyorktimes_json["response"]["docs"][0]["web_url"]
    assert blob.metadata.get(name="Author").value == author


def test_parse_shortcode():
    """Test shortcode extraction from various URL formats."""

    assert parse_shortcode("https://www.instagram.com/p/CUA4IQcARX2/") == "CUA4IQcARX2"

    assert parse_shortcode("https://www.instagram.com/tv/CWbejF6DD9B/") == "CWbejF6DD9B"

    assert parse_shortcode("https://www.instagram.com/p/CWixXZTLWgf/?utm_source=ig_web_copy_link") == "CWixXZTLWgf"

    assert parse_shortcode("https://www.artstation.com/artwork/0XQTnK") == "0XQTnK"

    with pytest.raises(Exception):
        parse_shortcode("https://www.instagram.com/42/")


def test_parse_date():
    """Test date parsing from various datetime string formats."""

    assert parse_date("2021-08-15 23:40:56") == "2021-08-15"
    assert parse_date("2021-11-15T15:56:23.875-06:00") == "2021-11-15"
    assert parse_date("January 1, 2022") == "January 1, 2022"


@patch("blob.services.get_blob_sizes")
def test_get_recent_blobs_does_not_n_plus_one_on_metadata(
    mock_get_blob_sizes, authenticated_client, django_assert_num_queries
):
    """Verify get_recent_blobs prefetches metadata so Blob.doctype does not fire
    one extra SELECT per blob (the N+1 that was introduced by commit 948c3e99)."""

    mock_get_blob_sizes.return_value = {}

    user, _ = authenticated_client()

    # Seed 3 blobs belonging to the same user. BlobFactory always creates at
    # least one MetaData row (the "Url" entry), which is what Blob.doctype reads.
    for _ in range(3):
        BlobFactory(user=user)

    # Warm-up call to settle any session/connection overhead.
    get_recent_blobs(user)

    with django_assert_num_queries(3) as ctx_3:
        blobs, doctypes = get_recent_blobs(user)
    assert len(blobs) == 3

    # Add 3 more blobs: query count must stay constant — proving the prefetch
    # is in effect and metadata is NOT fetched one-per-blob.
    for _ in range(3):
        BlobFactory(user=user)

    with django_assert_num_queries(3) as ctx_6:
        blobs2, doctypes2 = get_recent_blobs(user)
    assert len(blobs2) == 6


@patch("blob.services.OpenAI")
def test_chatbot_followups_returns_suggestions(mock_openai_cls):
    """chatbot_followups returns the suggestions list parsed from the model response."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[
            MagicMock(message=MagicMock(content=json.dumps({
                "suggestions": ["explain more", "give an example", "related notes"]
            })))
        ]
    )

    result = chatbot_followups("Some assistant reply.", mode="chat")

    assert result == ["explain more", "give an example", "related notes"]


@patch("blob.services.OpenAI")
def test_chatbot_followups_returns_empty_on_parse_error(mock_openai_cls):
    """chatbot_followups returns [] when the model response is not valid JSON."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[
            MagicMock(message=MagicMock(content="not json at all"))
        ]
    )

    result = chatbot_followups("Some reply.", mode="chat")

    assert result == []


@patch("blob.services.OpenAI")
def test_chatbot_followups_returns_empty_on_missing_key(mock_openai_cls):
    """chatbot_followups returns [] when JSON has no 'suggestions' key."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.return_value = MagicMock(
        choices=[
            MagicMock(message=MagicMock(content=json.dumps({"other": []})))
        ]
    )

    result = chatbot_followups("Some reply.", mode="chat")

    assert result == []


@patch("blob.services.OpenAI")
def test_chatbot_followups_returns_empty_on_api_error(mock_openai_cls):
    """chatbot_followups returns [] when the OpenAI client itself raises."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.side_effect = RuntimeError("api down")

    result = chatbot_followups("Some reply.", mode="chat")

    assert result == []


def _make_note_hit(name: str, contents: str, score: float, note_uuid: str | None = None) -> dict:
    """Build a fake Elasticsearch hit dict for notes RAG tests.

    Args:
        name: Note title stored in ``_source.name``.
        contents: Note body stored in ``_source.contents``.
        score: Similarity ``_score`` assigned to the hit.
        note_uuid: Optional note UUID; a random UUID is generated when omitted.

    Returns:
        A minimal hit dict matching the shape returned by ``semantic_search``.
    """
    return {
        "_score": score,
        "_source": {
            "uuid": note_uuid or str(uuid.uuid4()),
            "name": name,
            "contents": contents,
        },
    }


def test_build_notes_rag_messages_truncates_and_lists_sources():
    """_build_notes_rag_messages truncates long notes and builds a sources footer."""
    long_body = "x" * 2000
    note_uuid = str(uuid.uuid4())
    hits = [
        _make_note_hit("Alpha", long_body, 1.9, note_uuid=note_uuid),
        _make_note_hit("Beta", "short", 1.7),
    ]

    messages, footer = _build_notes_rag_messages("What is Alpha?", hits)

    assert messages[0]["role"] == "system"
    assert "Cite sources inline as markdown links" in messages[0]["content"]
    assert "Question: What is Alpha?" in messages[1]["content"]
    assert "Source 1: [Alpha]" in messages[1]["content"]
    assert "Source 2: [Beta]" in messages[1]["content"]
    assert "x" * 1500 in messages[1]["content"]
    assert "x" * 1501 not in messages[1]["content"]
    assert note_uuid in messages[1]["content"]
    assert "**Sources:**" in footer
    assert "1. [Alpha]" in footer
    assert "2. [Beta]" in footer


def test_build_notes_rag_messages_uses_passage():
    from blob.services import _build_notes_rag_messages

    hits = [{
        "_source": {"uuid": "11111111-1111-1111-1111-111111111111", "name": "Note One",
                    "contents": "FULL NOTE BODY THAT SHOULD NOT BE USED"},
        "_passage": "the precise matched passage",
    }]
    messages, footer = _build_notes_rag_messages("my question", hits)
    user_content = messages[1]["content"]
    assert "the precise matched passage" in user_content
    assert "FULL NOTE BODY THAT SHOULD NOT BE USED" not in user_content


def test_build_notes_rag_messages_passage_falls_back_to_contents():
    from blob.services import _build_notes_rag_messages

    hits = [{
        "_source": {"uuid": "11111111-1111-1111-1111-111111111111", "name": "Note One",
                    "contents": "fallback body"},
    }]
    messages, _ = _build_notes_rag_messages("q", hits)
    assert "fallback body" in messages[1]["content"]


@patch("blob.services.OpenAI")
def test_rewrite_notes_search_query_skips_rewrite_on_first_turn(mock_openai_cls):
    """_rewrite_notes_search_query returns the user message without calling OpenAI."""
    history = [{"role": "user", "content": "kitchen remodel"}]

    assert _rewrite_notes_search_query(history) == "kitchen remodel"
    mock_openai_cls.assert_not_called()


@patch("blob.services.OpenAI")
def test_rewrite_notes_search_query_rewrites_follow_up(mock_openai_cls):
    """_rewrite_notes_search_query uses gpt-4o-mini to rewrite multi-turn follow-ups."""
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(message=MagicMock(content="kitchen remodel timeline decisions"))
    ]
    mock_client.chat.completions.create.return_value = mock_response

    history = [
        {"role": "user", "content": "What did I note about the kitchen remodel?"},
        {"role": "assistant", "content": "You planned new cabinets and flooring."},
        {"role": "user", "content": "What about the timeline?"},
    ]

    assert _rewrite_notes_search_query(history) == "kitchen remodel timeline decisions"
    kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert kwargs["model"] == "gpt-4o-mini"
    assert kwargs["temperature"] == 0
    assert kwargs["max_tokens"] == 64
    assert "What about the timeline?" in kwargs["messages"][1]["content"]
    assert "kitchen remodel" in kwargs["messages"][1]["content"]


@patch("blob.services.OpenAI")
def test_rewrite_notes_search_query_falls_back_on_failure(mock_openai_cls):
    """_rewrite_notes_search_query falls back to the latest user message on API failure."""
    mock_openai_cls.return_value.chat.completions.create.side_effect = Exception("api down")
    history = [
        {"role": "user", "content": "kitchen remodel notes"},
        {"role": "assistant", "content": "You noted cabinets."},
        {"role": "user", "content": "What about the timeline?"},
    ]

    assert _rewrite_notes_search_query(history) == "What about the timeline?"


@patch("blob.services.OpenAI")
@patch("blob.services.semantic_search")
def test_chatbot_notes_no_hits_returns_message(mock_semantic_search, mock_openai_cls, authenticated_client):
    """Notes mode yields a friendly message and skips OpenAI when search returns no hits."""
    user, _ = authenticated_client()
    request = MagicMock()
    request.user = user
    mock_semantic_search.return_value = {"hits": {"hits": []}}

    output = "".join(chatbot(request, {
        "mode": "notes",
        "chat_history": json.dumps([{"role": "user", "content": "kitchen remodel"}]),
    }))

    assert "couldn't find any relevant notes" in output
    mock_openai_cls.assert_not_called()


@patch("blob.services.OpenAI")
@patch("blob.services.semantic_search")
def test_chatbot_notes_uses_top_hits_and_streams_sources(mock_semantic_search, mock_openai_cls, authenticated_client):
    """Notes mode sends multiple note excerpts to OpenAI and appends source links."""
    user, _ = authenticated_client()
    request = MagicMock()
    request.user = user
    note_uuid = str(uuid.uuid4())
    mock_semantic_search.return_value = {
        "hits": {
            "hits": [
                _make_note_hit("Best", "best content", 1.9, note_uuid=note_uuid),
                _make_note_hit("Second", "second content", 1.6),
            ],
        },
    }

    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_chunk = MagicMock()
    mock_chunk.choices = [MagicMock(delta=MagicMock(content="Answer text"))]
    mock_client.chat.completions.create.return_value = iter([mock_chunk])

    output = "".join(chatbot(request, {
        "mode": "notes",
        "chat_history": json.dumps([{"role": "user", "content": "What did I decide?"}]),
    }))

    assert "Answer text" in output
    assert "**Sources:**" in output
    assert "1. [Best]" in output
    assert "2. [Second]" in output
    call_messages = mock_client.chat.completions.create.call_args.kwargs["messages"]
    assert call_messages[0]["role"] == "system"
    assert "Cite sources inline as markdown links" in call_messages[0]["content"]
    assert "Source 1: [Best]" in call_messages[1]["content"]
    assert "Source 2: [Second]" in call_messages[1]["content"]


@patch("blob.services.OpenAI")
@patch("blob.services.semantic_search")
def test_chatbot_notes_rewrites_follow_up_for_retrieval(
    mock_semantic_search, mock_openai_cls, authenticated_client
):
    """Notes mode rewrites follow-up retrieval queries but keeps the literal user question."""
    user, _ = authenticated_client()
    request = MagicMock()
    request.user = user
    note_uuid = str(uuid.uuid4())
    mock_semantic_search.return_value = {
        "hits": {
            "hits": [
                _make_note_hit("Kitchen Remodel", "timeline content", 1.9, note_uuid=note_uuid),
            ],
        },
    }

    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    rewrite_response = MagicMock()
    rewrite_response.choices = [
        MagicMock(message=MagicMock(content="kitchen remodel timeline decisions"))
    ]
    mock_chunk = MagicMock()
    mock_chunk.choices = [MagicMock(delta=MagicMock(content="Timeline answer"))]

    def create_side_effect(**kwargs):
        if kwargs.get("stream"):
            return iter([mock_chunk])
        return rewrite_response

    mock_client.chat.completions.create.side_effect = create_side_effect

    chat_history = [
        {"role": "user", "content": "What did I note about the kitchen remodel?"},
        {"role": "assistant", "content": "You planned new cabinets."},
        {"role": "user", "content": "What about the timeline?"},
    ]
    output = "".join(chatbot(request, {
        "mode": "notes",
        "chat_history": json.dumps(chat_history),
    }))

    mock_semantic_search.assert_called_once_with(
        request, "kitchen remodel timeline decisions"
    )
    assert "Timeline answer" in output
    stream_kwargs = mock_client.chat.completions.create.call_args_list[-1].kwargs
    assert stream_kwargs["stream"] is True
    assert "Question: What about the timeline?" in stream_kwargs["messages"][1]["content"]
