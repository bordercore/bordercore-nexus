import pytest

from django.urls import reverse

try:
    from .pages.prefs import PrefsPage
except (ModuleNotFoundError, NameError):
    # Don't worry if these imports don't exist in production
    pass

pytestmark = pytest.mark.functional


@pytest.mark.parametrize("login", [reverse("accounts:prefs")], indirect=True)
def test_prefs(collection, login, live_server, browser, settings, s3_resource, s3_bucket):

    settings.DEBUG = True
    COLLECTION_NAME = "collection_0"
    THEME_NAME = "dark"

    page = PrefsPage(browser)
    page.load(live_server)

    assert page.title_value() == "Preferences"

    # Choose a default collection
    page.choose_default_collection(COLLECTION_NAME)

    # Choose the 'dark' theme
    page.choose_theme(THEME_NAME)

    # Test that preferences were successfully updated
    page.update()
    assert page.prefs_updated_message() == "Preferences edited"

    # Test that the theme was switched
    assert page.selected_theme() == THEME_NAME

    # Test that the default collection was switched
    assert page.selected_default_collection() == COLLECTION_NAME
