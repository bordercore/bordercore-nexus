import time
from unittest.mock import MagicMock, patch

import pytest

from django.urls import reverse

try:
    from .pages.drill import SummaryPage
except (ModuleNotFoundError, NameError):
    # Don't worry if these imports don't exist in production
    pass

pytestmark = pytest.mark.functional


@pytest.fixture
def mock_es_for_drill_tag_search(question):
    """
    Mock Elasticsearch for drill tag search/autocomplete.

    The drill test uses tag autocomplete which queries ES for tag suggestions.
    This mock returns appropriate tag aggregation results.
    """

    with patch("lib.util._get_elasticsearch_connection") as mock_get_es:
        mock_es_client = MagicMock()

        # Collect all tags from questions
        all_tags = {}
        for q in question:
            for tag in q.tags.all():
                if tag.name not in all_tags:
                    all_tags[tag.name] = 0
                all_tags[tag.name] += 1

        def mock_search(index=None, **search_object):
            """
            Mock ES search for tag aggregations.

            When the tag autocomplete component searches, it expects
            aggregation results with tag buckets.
            """
            query = search_object.get("query", {})

            # Extract search term from query
            search_term = ""
            bool_query = query.get("bool", {})
            must_clauses = bool_query.get("must", [])

            for clause in must_clauses:
                if "bool" in clause and "should" in clause["bool"]:
                    should_clauses = clause["bool"]["should"]
                    for should_clause in should_clauses:
                        if "match" in should_clause:
                            for field, match_data in should_clause["match"].items():
                                if "autocomplete" in field:
                                    if isinstance(match_data, dict):
                                        search_term = match_data.get("query", "").lower()
                                    else:
                                        search_term = str(match_data).lower()
                                    break

            # Check for aggregations (check both possible names)
            aggs_dict = search_object.get("aggregations", search_object.get("aggs", {}))

            if "Distinct Tags" in aggs_dict or "distinct_tags" in aggs_dict:
                # Return tag buckets filtered by search term
                tag_buckets = []
                for tag_name, count in all_tags.items():
                    if not search_term or search_term in tag_name.lower():
                        tag_buckets.append({
                            "key": tag_name,
                            "doc_count": count
                        })

                # Use the correct aggregation name based on what was requested
                agg_name = "distinct_tags" if "distinct_tags" in aggs_dict else "Distinct Tags"

                return {
                    "hits": {"hits": [], "total": {"value": 0}},
                    "aggregations": {
                        agg_name: {
                            "buckets": tag_buckets
                        }
                    }
                }

            # If not an aggregation query, return empty results
            return {
                "hits": {"hits": [], "total": {"value": 0}}
            }

        mock_es_client.search = mock_search
        mock_get_es.return_value = mock_es_client

        yield mock_es_client


@pytest.mark.parametrize("login", [reverse("drill:list")], indirect=True)
def test_tag_search(question, login, live_server, browser, settings, mock_es_for_drill_tag_search):

    tag_name = question[0].tags.all().first().name

    page = SummaryPage(browser)

    element = page.study_button()
    element.click()

    time.sleep(1)

    element = page.tag_radio_option()
    element.click()

    element = page.tag_input()
    element.send_keys(tag_name)

    # Wait for dropdown to populate
    time.sleep(1)

    element = page.tag_dropdown_option(tag_name)
    element.click()

    element = page.start_study_session_button()
    element.click()

    element = page.question_text()
    assert element == question[0].question.replace("\n", " ")

    element = page.breadcrumb()
    assert element == "django"
