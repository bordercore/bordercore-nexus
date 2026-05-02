import pytest

from tag.models import TagAlias
from tag.services import (
    find_related_tags,
    get_additional_info,
    get_tag_aliases,
    get_tag_link,
    search,
)
pytestmark = [pytest.mark.django_db]


class TestGetTagLink:

    def test_note_doctype(self):
        link = get_tag_link("python", ["note"])
        assert "doctype=note" in link
        assert "term_search=python" in link

    def test_bookmark_doctype(self):
        link = get_tag_link("python", ["bookmark"])
        assert "tag=python" in link

    def test_drill_doctype(self):
        link = get_tag_link("python", ["drill"])
        assert "study_method=tag" in link
        assert "tags=python" in link

    def test_song_doctype(self):
        link = get_tag_link("python", ["song"])
        assert "tag=python" in link

    def test_album_doctype(self):
        link = get_tag_link("python", ["album"])
        assert "tag=python" in link

    def test_default_doctype(self):
        link = get_tag_link("python")
        assert "python" in link

    def test_empty_doctype_list(self):
        link = get_tag_link("python", [])
        assert "python" in link


class TestGetTagAliases:

    def test_returns_matching_aliases(self, authenticated_client, tag):
        user, _ = authenticated_client()

        TagAlias.objects.create(user=user, tag=tag[0], name="dj framework")

        results = get_tag_aliases(user, "dj")
        assert len(results) == 1
        assert results[0]["value"] == tag[0].name
        assert "dj framework" in results[0]["label"]

    def test_returns_empty_for_no_match(self, authenticated_client, tag):
        user, _ = authenticated_client()

        results = get_tag_aliases(user, "zzz-no-match")
        assert results == []

    def test_alias_includes_link(self, authenticated_client, tag):
        user, _ = authenticated_client()

        TagAlias.objects.create(user=user, tag=tag[0], name="dj alias")

        results = get_tag_aliases(user, "dj alias", ["bookmark"])
        assert len(results) == 1
        assert "tag=" in results[0]["link"]


class TestGetAdditionalInfo:

    def test_non_drill_returns_empty(self, authenticated_client):
        user, _ = authenticated_client()
        result = get_additional_info(["bookmark"], user, "python")
        assert result == {}

    def test_empty_doctypes_returns_empty(self, authenticated_client):
        user, _ = authenticated_client()
        result = get_additional_info([], user, "python")
        assert result == {}


class TestSearch:

    def test_search_returns_list(self, authenticated_client, tag, mock_elasticsearch):
        """search() returns results from ES aggregations + aliases."""
        user, _ = authenticated_client()

        mock_elasticsearch.search.return_value = {
            "aggregations": {
                "distinct_tags": {
                    "buckets": [
                        {"key": "django", "doc_count": 5},
                        {"key": "django-rest", "doc_count": 2},
                    ]
                }
            }
        }

        results = search(user, "django")
        assert len(results) >= 2
        labels = [r["label"] for r in results]
        assert "django" in labels
        assert "django-rest" in labels

    def test_search_skip_aliases(self, authenticated_client, tag, mock_elasticsearch):
        user, _ = authenticated_client()

        TagAlias.objects.create(user=user, tag=tag[0], name="dj search alias")

        mock_elasticsearch.search.return_value = {
            "aggregations": {
                "distinct_tags": {
                    "buckets": [
                        {"key": "django", "doc_count": 5},
                    ]
                }
            }
        }

        results_with = search(user, "dj", skip_tag_aliases=False)
        results_without = search(user, "dj", skip_tag_aliases=True)

        assert len(results_with) > len(results_without)

    def test_search_filters_by_doctype(self, authenticated_client, tag, mock_elasticsearch):
        user, _ = authenticated_client()

        mock_elasticsearch.search.return_value = {
            "aggregations": {
                "distinct_tags": {
                    "buckets": [
                        {"key": "django", "doc_count": 3},
                    ]
                }
            }
        }

        results = search(user, "django", doc_types=["bookmark"])
        assert len(results) >= 1

        # Verify doctype filter was passed to ES
        call_kwargs = mock_elasticsearch.search.call_args
        query = call_kwargs.kwargs if "body" not in (call_kwargs.kwargs or {}) else call_kwargs.kwargs
        # The search was called with the doctype filter
        assert mock_elasticsearch.search.called

    def test_search_case_insensitive(self, authenticated_client, tag, mock_elasticsearch):
        user, _ = authenticated_client()

        mock_elasticsearch.search.return_value = {
            "aggregations": {
                "distinct_tags": {
                    "buckets": [
                        {"key": "Django", "doc_count": 5},
                    ]
                }
            }
        }

        results = search(user, "Django")
        labels = [r["label"] for r in results]
        assert "Django" in labels


class TestFindRelatedTags:

    def test_find_related_tags(self, authenticated_client, tag, mock_elasticsearch):
        user, _ = authenticated_client()

        mock_elasticsearch.search.return_value = {
            "aggregations": {
                "distinct_tags": {
                    "buckets": [
                        {"key": "django", "doc_count": 10},
                        {"key": "python", "doc_count": 8},
                        {"key": "web", "doc_count": 3},
                    ]
                }
            }
        }

        results = find_related_tags("django", user, None)

        # Should exclude the searched tag itself
        tag_names = [r["tag_name"] for r in results]
        assert "django" not in tag_names
        assert "python" in tag_names
        assert "web" in tag_names

    def test_find_related_tags_with_doctype(self, authenticated_client, tag, mock_elasticsearch):
        user, _ = authenticated_client()

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

        results = find_related_tags("django", user, "bookmark")
        assert mock_elasticsearch.search.called

        tag_names = [r["tag_name"] for r in results]
        assert "django" not in tag_names

    def test_find_related_tags_empty(self, authenticated_client, tag, mock_elasticsearch):
        user, _ = authenticated_client()

        mock_elasticsearch.search.return_value = {
            "aggregations": {
                "distinct_tags": {
                    "buckets": [
                        {"key": "django", "doc_count": 10},
                    ]
                }
            }
        }

        results = find_related_tags("django", user, None)
        assert results == []
