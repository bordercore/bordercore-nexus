import time
from unittest.mock import MagicMock, patch

import pytest
from faker import Factory as FakerFactory

from django.urls import reverse

from blob.models import Blob
from blob.tests.factories import BlobFactory
from bookmark.tests.factories import BookmarkFactory

try:
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.webdriver.common.keys import Keys

    from .pages.node import NodeListPage
except (ModuleNotFoundError, NameError):
    # Don't worry if these imports don't exist in production
    pass

pytestmark = pytest.mark.functional


def _delete_input(action, search_input):
    """
    Delete the current input text
    """

    action.reset_actions()
    action.move_to_element(search_input).perform()

    action.send_keys(Keys.BACKSPACE). \
        send_keys(Keys.BACKSPACE). \
        send_keys(Keys.BACKSPACE). \
        send_keys(Keys.BACKSPACE). \
        perform()

    time.sleep(1)
    action.send_keys(Keys.BACKSPACE).perform()


def _filtered_search(action, search_input, checkbox, name):
    """
    Perform a filtered search
    """

    action.reset_actions()
    action.move_to_element(checkbox). \
        click(). \
        move_to_element(search_input). \
        click(). \
        send_keys(name). \
        perform()


def _create_es_search_response(hits, total=None):
    """
    Create a mock Elasticsearch search response
    """
    if total is None:
        total = len(hits)

    return {
        "hits": {
            "hits": hits,
            "total": {"value": total}
        }
    }


def _create_es_hit(doc_source, doc_id, score=1.0):
    """
    Create a mock Elasticsearch hit document
    """
    return {
        "_id": doc_id,
        "_source": doc_source,
        "_score": score
    }


@pytest.fixture
def mock_es_for_node_test(node, bookmark):
    """
    Mock Elasticsearch to return appropriate results for the node test.

    This fixture creates a mock ES client that returns:
    - Recent items when no search term is provided
    - Search results based on the query and filters
    """

    with patch("lib.util._get_elasticsearch_connection") as mock_get_es:
        mock_es_client = MagicMock()

        # Store created objects for search responses
        created_blobs = {}
        created_bookmarks = {}

        # Pre-populate with fixture data
        # Get all existing blobs from the node fixture
        for blob in Blob.objects.all():
            created_blobs[str(blob.uuid)] = {
                "uuid": str(blob.uuid),
                "name": blob.name,
                "doctype": "blob" if blob.sha1sum else "document",
                "user_id": blob.user.id,
                "date": blob.date or "",
                "date_unixtime": int(blob.created.timestamp()),
                "note": blob.note or "",
                "importance": blob.importance,
                "filename": blob.file.name if blob.file else "",
            }

        # Get all existing bookmarks from the bookmark fixture
        for bm in bookmark:
            created_bookmarks[str(bm.uuid)] = {
                "uuid": str(bm.uuid),
                "name": bm.name,
                "doctype": "bookmark",
                "user_id": bm.user.id,
                "url": bm.url,
                "note": bm.note or "",
                "importance": bm.importance or 1,
                "date_unixtime": int(bm.created.timestamp()),
            }

        def mock_search(index=None, **search_object):
            """
            Mock ES search that returns results based on the query
            """
            query = search_object.get("query", {})

            # Extract search term from the query structure
            search_term = None
            bool_query = query.get("function_score", {}).get("query", {}).get("bool", {})
            must_clauses = bool_query.get("must", [])

            # Find the search term from the query structure
            for clause in must_clauses:
                if "bool" in clause and "should" in clause["bool"]:
                    should_clauses = clause["bool"]["should"]
                    for should_clause in should_clauses:
                        if "match" in should_clause:
                            for field, match_data in should_clause["match"].items():
                                if isinstance(match_data, dict):
                                    search_term = match_data.get("query", "")
                                    break
                                else:
                                    search_term = match_data
                                    break

            # Check for doctype filters
            doctype_filter = None
            for clause in must_clauses:
                if "bool" in clause and "should" in clause["bool"]:
                    # Check if this is a doctype filter
                    should_clauses = clause["bool"]["should"]
                    doctypes = []
                    for should_clause in should_clauses:
                        if "term" in should_clause and "doctype" in should_clause["term"]:
                            doctypes.append(should_clause["term"]["doctype"])
                    if doctypes:
                        doctype_filter = doctypes

            hits = []

            # Return results based on search term and filters
            if search_term:
                search_term_lower = search_term.lower()

                # Search through created blobs
                for blob_uuid, blob_data in created_blobs.items():
                    if search_term_lower in blob_data["name"].lower():
                        # Check doctype filter
                        if doctype_filter is None or blob_data["doctype"] in doctype_filter:
                            hits.append(_create_es_hit(blob_data, blob_uuid))

                # Search through created bookmarks
                for bookmark_uuid, bookmark_data in created_bookmarks.items():
                    if search_term_lower in bookmark_data["name"].lower():
                        # Check doctype filter
                        if doctype_filter is None or bookmark_data["doctype"] in doctype_filter:
                            hits.append(_create_es_hit(bookmark_data, bookmark_uuid))
            else:
                # Return recent items (no search term)
                # Get all blobs and bookmarks
                all_items = []
                for blob_uuid, blob_data in created_blobs.items():
                    all_items.append(_create_es_hit(blob_data, blob_uuid))
                for bookmark_uuid, bookmark_data in created_bookmarks.items():
                    all_items.append(_create_es_hit(bookmark_data, bookmark_uuid))

                # Sort by date_unixtime descending to get most recent
                all_items.sort(key=lambda x: x["_source"].get("date_unixtime", 0), reverse=True)

                # Return the most recent 12 items
                hits = all_items[:12]

            return _create_es_search_response(hits)

        mock_es_client.search = mock_search
        mock_get_es.return_value = mock_es_client

        # Provide a way for the test to register created objects
        yield {
            "client": mock_es_client,
            "register_blob": lambda blob: created_blobs.update({
                str(blob.uuid): {
                    "uuid": str(blob.uuid),
                    "name": blob.name,
                    "doctype": "blob" if blob.sha1sum else "document",
                    "user_id": blob.user.id,
                    "date": blob.date or "",
                    "date_unixtime": int(blob.created.timestamp()),
                    "note": blob.note or "",
                    "importance": blob.importance or 1,
                    "filename": blob.file.name if blob.file else "",
                }
            }),
            "register_bookmark": lambda bookmark: created_bookmarks.update({
                str(bookmark.uuid): {
                    "uuid": str(bookmark.uuid),
                    "name": bookmark.name,
                    "doctype": "bookmark",
                    "user_id": bookmark.user.id,
                    "url": bookmark.url,
                    "note": bookmark.note or "",
                    "importance": bookmark.importance or 1,
                    "date_unixtime": int(bookmark.created.timestamp()),
                }
            })
        }


@pytest.mark.parametrize("login", [reverse("node:list")], indirect=True)
def test_node_list(node, bookmark, login, live_server, browser, settings, mock_es_for_node_test):

    page = NodeListPage(browser)

    user = node.user

    assert page.title_value() == "Node List"

    element = page.node_detail_link()
    element.click()

    action = ActionChains(browser)
    menu = page.collection_menu()
    action.move_to_element(menu).perform()
    page.dropdown_menu_container(menu).click()
    page.menu_item(menu).click()

    modal = page.select_object_modal()
    menu_items = page.recent_items(modal)
    assert len(menu_items) == 12

    search_input = page.search_input(modal)

    # Get a recent blob
    blob = Blob.objects.all().order_by("-created")[0]
    # Register it with the mock ES
    mock_es_for_node_test["register_blob"](blob)

    # Search for it by typing the first 5 letters of its title
    action.reset_actions()
    action.move_to_element(search_input)
    page.wait_for_focus(modal, page.SEARCH_INPUT)
    action.send_keys(blob.name[:5]).perform()
    time.sleep(1)

    # Verify that it's shown in the suggestion menu
    suggestion = page.search_suggestion_first(modal, wait=True)
    assert suggestion.text.lower() == blob.name.lower()

    _delete_input(action, search_input)

    # Create a new blob and bookmark with the same unique name
    # Use a UUID prefix to ensure uniqueness and avoid matching existing fixtures
    import uuid
    unique_prefix = str(uuid.uuid4())[:8]
    name = f"TEST_{unique_prefix}_UniqueItem"
    blob_1 = BlobFactory.create(user=user, name=name)
    bookmark_1 = BookmarkFactory.create(user=user, name=name)

    # Register them with the mock ES
    mock_es_for_node_test["register_blob"](blob_1)
    mock_es_for_node_test["register_bookmark"](bookmark_1)

    # Wait for the objects to be indexed in Elasticsearch
    time.sleep(1)

    # Filter on 'bookmarks'
    checkbox = page.checkbox_bookmarks(modal)
    search_input = page.search_input(modal)

    # Search for the bookmark
    _filtered_search(action, search_input, checkbox, bookmark_1.name[:5])

    time.sleep(1)

    # With the filter on, there should only be one match, plus the empty first suggestion
    suggestion_list = page.search_suggestion_list(modal)
    assert len(suggestion_list) == 2

    _delete_input(action, search_input)

    # Filter on 'blobs'
    checkbox = page.checkbox_blobs(modal)
    _filtered_search(action, search_input, checkbox, blob_1.name[:5])

    time.sleep(1)

    # With the filter on, there should only be one match, plus the empty first suggestion
    suggestion_list = page.search_suggestion_list(modal)
    assert len(suggestion_list) == 2

    _delete_input(action, search_input)

    # Remove the filter
    _filtered_search(action, search_input, checkbox, blob_1.name[:5])

    time.sleep(1)

    # With the filter off, there should be two matches, plus the empty first suggestion
    suggestion_list = page.search_suggestion_list(modal)
    assert len(suggestion_list) == 3
