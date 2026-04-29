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
    """Magazine homepage with fixtures: tasks render in the front-page column,
    recent bookmarks render in the classifieds rail."""

    settings.DEBUG = True

    page = HomePage(browser)

    assert page.title_value() == "Bordercore"

    # Two high-priority tasks from fixtures
    assert page.todo_count() == 2

    # Two recent untagged bookmarks from fixtures
    assert page.bookmarks_count() == 2


@pytest.mark.parametrize("login", [reverse("homepage:homepage")], indirect=True)
def test_homepage_no_fixtures(login, live_server, browser, settings):
    """Magazine homepage with no fixtures: empty states render in place of the
    tasks list and the classifieds rail."""

    settings.DEBUG = True

    page = HomePage(browser)

    assert page.title_value() == "Bordercore"

    # No tasks: zero task rows, "all clear" empty state visible.
    assert page.todo_count() == 0
    assert page.todo_empty_text() == "All clear — no high-priority tasks."

    # No recent bookmarks
    assert page.bookmarks_count() == 0
