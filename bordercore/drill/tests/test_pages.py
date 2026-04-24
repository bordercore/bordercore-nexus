import pytest

from django.urls import reverse

try:
    from .pages.drill import SummaryPage
except (ModuleNotFoundError, NameError):
    # Don't worry if these imports don't exist in production
    pass

pytestmark = [pytest.mark.functional]


@pytest.mark.parametrize("login", [reverse("drill:list")], indirect=True)
def test_tag_search(question, login, live_server, browser):
    tag_name = question[0].tags.all().first().name

    page = SummaryPage(browser)

    element = page.tag_row(tag_name)
    element.click()

    element = page.question_text()
    assert element == question[0].question.replace("\n", " ")

    element = page.breadcrumb()
    assert element == "django"
