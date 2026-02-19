import pytest

from django import urls

from tag.models import TagAlias

pytestmark = [pytest.mark.django_db]


def test_tag_pin(authenticated_client, tag):

    _, client = authenticated_client()

    url = urls.reverse("tag:pin")
    resp = client.post(url, {
        "tag": "django"
    })

    assert resp.status_code == 302


def test_tag_unpin(authenticated_client, tag):

    _, client = authenticated_client()

    tag[0].pin()

    url = urls.reverse("tag:unpin")
    resp = client.post(url, {
        "tag": "django"
    })

    assert resp.status_code == 302


def test_tag_list(authenticated_client, tag):

    user, client = authenticated_client()

    url = urls.reverse("tag:list")
    resp = client.get(url)

    assert resp.status_code == 200


def test_tag_add_alias(authenticated_client, tag):

    user, client = authenticated_client()

    tag_alias_name = "tag alias name"

    url = urls.reverse("tag:add_alias")
    resp = client.post(url, {
        "tag_name": tag[0].name,
        "alias_name": tag_alias_name
    })

    assert resp.status_code == 200

    tag_alias = TagAlias.objects.filter(name=tag_alias_name, tag=tag[0], user=user)

    assert tag_alias.exists()

    resp = client.post(url, {
        "tag_name": tag[0].name,
        "alias_name": tag_alias_name
    })

    assert resp.status_code == 200
    assert resp.json()["message"] == "Alias already exists"

    resp = client.post(url, {
        "tag_name": tag_alias,
        "alias_name": tag[0].name
    })

    assert resp.status_code == 200
    assert resp.json()["message"] == f"A tag with the name '{tag[0]}' already exists"


def test_tag_todo_counts(authenticated_client, tag):

    user, client = authenticated_client()

    url = urls.reverse("tag:get_todo_counts")
    resp = client.get(url)

    assert resp.status_code == 200

    response = resp.json()
    assert response["info"]["name"] in [x.name for x in tag]

    url = urls.reverse("tag:get_todo_counts")
    resp = client.get(f"{url}?tag_name={tag[1]}")

    assert resp.status_code == 200

    response = resp.json()
    assert response["info"]["name"] == tag[1].name
    assert response["info"]["blob__count"] == 0


def test_tag_search(authenticated_client, tag, mock_elasticsearch):
    """Search view returns matching tags from ES."""

    _, client = authenticated_client()

    mock_elasticsearch.search.return_value = {
        "aggregations": {
            "distinct_tags": {
                "buckets": [
                    {"key": "django", "doc_count": 5},
                ]
            }
        }
    }

    url = urls.reverse("tag:search")
    resp = client.get(f"{url}?query=django")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    labels = [r["label"] for r in data]
    assert "django" in labels


def test_tag_search_with_doctype(authenticated_client, tag, mock_elasticsearch):

    _, client = authenticated_client()

    mock_elasticsearch.search.return_value = {
        "aggregations": {
            "distinct_tags": {
                "buckets": [
                    {"key": "django", "doc_count": 3},
                ]
            }
        }
    }

    url = urls.reverse("tag:search")
    resp = client.get(f"{url}?query=django&doctype=bookmark")

    assert resp.status_code == 200


def test_tag_search_skip_aliases(authenticated_client, tag, mock_elasticsearch):

    user, client = authenticated_client()

    from tag.models import TagAlias
    TagAlias.objects.create(user=user, tag=tag[0], name="dj view alias")

    mock_elasticsearch.search.return_value = {
        "aggregations": {
            "distinct_tags": {
                "buckets": [
                    {"key": "django", "doc_count": 5},
                ]
            }
        }
    }

    url = urls.reverse("tag:search")

    resp_with = client.get(f"{url}?query=dj")
    resp_skip = client.get(f"{url}?query=dj&skip_tag_aliases=true")

    assert resp_with.status_code == 200
    assert resp_skip.status_code == 200
    assert len(resp_with.json()) >= len(resp_skip.json())


def test_get_related_tags(authenticated_client, tag, mock_elasticsearch):

    _, client = authenticated_client()

    mock_elasticsearch.search.return_value = {
        "aggregations": {
            "distinct_tags": {
                "buckets": [
                    {"key": "django", "doc_count": 10},
                    {"key": "python", "doc_count": 8},
                ]
            }
        }
    }

    url = urls.reverse("tag:get_related_tags")
    resp = client.get(f"{url}?tag_name=django")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OK"

    tag_names = [r["tag_name"] for r in data["info"]]
    assert "django" not in tag_names
    assert "python" in tag_names


def test_get_related_tags_with_doc_type(authenticated_client, tag, mock_elasticsearch):

    _, client = authenticated_client()

    mock_elasticsearch.search.return_value = {
        "aggregations": {
            "distinct_tags": {
                "buckets": [
                    {"key": "django", "doc_count": 10},
                    {"key": "rest-api", "doc_count": 4},
                ]
            }
        }
    }

    url = urls.reverse("tag:get_related_tags")
    resp = client.get(f"{url}?tag_name=django&doc_type=bookmark")

    assert resp.status_code == 200


def test_pin_missing_tag_field(authenticated_client, tag):
    """Pin view requires 'tag' in POST data."""

    _, client = authenticated_client()

    url = urls.reverse("tag:pin")
    resp = client.post(url, {})

    assert resp.status_code == 400


def test_unpin_missing_tag_field(authenticated_client, tag):
    """Unpin view requires 'tag' in POST data."""

    _, client = authenticated_client()

    url = urls.reverse("tag:unpin")
    resp = client.post(url, {})

    assert resp.status_code == 400
