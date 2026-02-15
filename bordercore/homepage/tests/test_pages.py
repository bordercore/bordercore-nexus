import pytest

from django.urls import reverse

try:
    from .pages.homepage import HomePage
except (ModuleNotFoundError, NameError):
    # Don't worry if these imports don't exist in production
    pass

pytestmark = [pytest.mark.functional]


@pytest.mark.parametrize("login", [reverse("homepage:homepage")], indirect=True)
def test_homepage(bookmark, question, todo, login, live_server, browser, settings):
    """
    Test the homepage for a user with all fixtures
    """

    settings.DEBUG = True

    page = HomePage(browser)

    assert page.title_value() == "Bordercore"

    # There should be two important todo tasks
    assert page.todo_count() == 2

    # There should be two recent untagged bookmarks
    assert page.bookmarks_count() == 2

    # There should be one pinned bookmark
    assert page.pinned_bookmarks_count() == 1


@pytest.mark.parametrize("login", [reverse("homepage:homepage")], indirect=True)
def test_homepage_no_fixtures(login, live_server, browser, settings):
    """
    Test the homepage for a user with no fixtures
    """

    settings.DEBUG = True

    page = HomePage(browser)

    assert page.title_value() == "Bordercore"

    # There should be no important todo tasks, just an "All done!" message
    assert page.todo_count() == 1

    # The lone todo item should say "All done!"
    assert page.todo_item(0) == "All done!"

    # There should be no recent untagged bookmarks
    assert page.bookmarks_count() == 0

    # There should be no pinned bookmarks
    assert page.pinned_bookmarks_count() == 0
