import time

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
