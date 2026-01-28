import time
import uuid

import pytest

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


@pytest.mark.parametrize("login", [reverse("node:list")], indirect=True)
def test_node_list(node, bookmark, login, live_server, browser, settings, mock_es_for_node_test):
    """
    Test node list and object select modal using search (not recent items).
    The React ObjectSelectModal loads recent items from DOM; when empty due to
    mock_get_recent_blobs, we verify the modal opens and search works instead.
    """
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
    time.sleep(0.5)

    # Verify modal is open and has search input (don't rely on recent items)
    search_input = page.search_input(modal)
    assert search_input is not None

    # Register a blob with the mock ES and search for it
    blob = Blob.objects.filter(user=user).order_by("-created").first()
    assert blob is not None, "Need at least one blob from fixtures"
    mock_es_for_node_test["register_blob"](blob)

    search_term = blob.name[:5]
    action.reset_actions()
    action.move_to_element(search_input).click().send_keys(search_term).perform()
    time.sleep(1)

    suggestion = page.search_suggestion_first(modal, wait=True)
    # Extract just the name from the suggestion (exclude date)
    try:
        name_element = suggestion.find_element("css selector", ".name .text-truncate")
        suggestion_name = name_element.text.strip()
    except Exception:
        # Fallback: try to get text from .name div (first line only)
        try:
            name_element = suggestion.find_element("css selector", ".name")
            suggestion_name = name_element.text.split("\n")[0].strip()
        except Exception:
            # Last resort: use full text and split by newline
            suggestion_name = suggestion.text.split("\n")[0].strip()
    assert suggestion_name.lower() == blob.name.lower()

    _delete_input(action, search_input)

    # Create a new blob and bookmark, register with mock ES, search for both
    unique_prefix = str(uuid.uuid4())[:8]
    name = f"TEST_{unique_prefix}_UniqueItem"
    blob_1 = BlobFactory.create(user=user, name=name)
    bookmark_1 = BookmarkFactory.create(user=user, name=name)
    mock_es_for_node_test["register_blob"](blob_1)
    mock_es_for_node_test["register_bookmark"](bookmark_1)
    time.sleep(0.5)

    # Search for the bookmark by name
    action.reset_actions()
    action.move_to_element(search_input).click().send_keys(bookmark_1.name[:5]).perform()
    time.sleep(1)
    suggestion_list = page.search_suggestion_list(modal)
    assert len(suggestion_list) >= 1
    assert any(bookmark_1.name.lower() in s.text.lower() for s in suggestion_list)

    _delete_input(action, search_input)

    # Search for the blob by name
    action.reset_actions()
    action.move_to_element(search_input).click().send_keys(blob_1.name[:5]).perform()
    time.sleep(1)
    suggestion_list = page.search_suggestion_list(modal)
    assert len(suggestion_list) >= 1
    assert any(blob_1.name.lower() in s.text.lower() for s in suggestion_list)
