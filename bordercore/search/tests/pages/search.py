try:
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import Select
    from selenium.webdriver.support.wait import WebDriverWait
except ModuleNotFoundError:
    # Don't worry if this import doesn't exist in production
    pass

from test_page import Page


class SearchPage(Page):

    SEARCH_INPUT = (By.CSS_SELECTOR, "input#search-bar")
    SEARCH_EXACT_MATCH_DROPDOWN = (By.CSS_SELECTOR, "select[name='exact_match']")
    SUBMIT_BUTTON = (By.CSS_SELECTOR, "input[type='submit']")
    SEARCH_RESULT_COUNT = (By.CSS_SELECTOR, "h4[class^='search-result-header'] strong")
    SEARCH_RESULT_NAME = (By.CSS_SELECTOR, "li[class*='search-result'] h4 a")
    SEARCH_RESULT_TAG = (By.CSS_SELECTOR, "li a.tag")

    def __init__(self, browser):
        self.browser = browser

    def search_input(self):
        """
        Find the search form input - wait for Vue to mount
        """
        wait = WebDriverWait(self.browser, timeout=10)
        wait.until(lambda driver: driver.find_element(*self.SEARCH_INPUT))
        return self.browser.find_element(*self.SEARCH_INPUT)

    def exact_match_select(self):
        """
        Find the "Exact Match" dropdown - wait for Vue to mount
        """
        wait = WebDriverWait(self.browser, timeout=10)
        wait.until(lambda driver: driver.find_element(*self.SEARCH_EXACT_MATCH_DROPDOWN))
        return Select(self.browser.find_element(*self.SEARCH_EXACT_MATCH_DROPDOWN))

    def submit_button(self):
        """
        Find the form submit button
        """
        wait = WebDriverWait(self.browser, timeout=10)
        wait.until(lambda driver: driver.find_element(*self.SUBMIT_BUTTON))
        return self.browser.find_element(*self.SUBMIT_BUTTON)

    def search_result_count(self, wait=False):
        """
        Find the text of the first ask
        """
        element = self.find_element(self.browser, self.SEARCH_RESULT_COUNT, wait)
        return int(element.get_attribute("innerHTML"))

    def search_result_name(self):
        """
        Find the text of the search result
        """
        element = self.browser.find_element(*self.SEARCH_RESULT_NAME)
        return element.get_attribute("innerHTML")

    def search_result_tag_count(self):
        """
        Find the search result tag count
        """
        return len(self.browser.find_elements(*self.SEARCH_RESULT_TAG))

    def search_result_tags(self):
        """
        Find the search result tag list
        """
        element = self.browser.find_elements(*self.SEARCH_RESULT_TAG)
        return [x.get_attribute("innerHTML") for x in element]


class TagSearchPage(Page):

    SEARCH_INPUT = (By.CSS_SELECTOR, "input[placeholder='Tag']")
    SEARCH_TAG_RESULT = (By.CSS_SELECTOR, "li[class*='search-result']")

    def __init__(self, browser):
        self.browser = browser

    def search_input(self):
        """
        Find the search form input
        """
        return self.browser.find_element(*self.SEARCH_INPUT)

    def search_tag_result_count(self, wait=False):
        """
        Find the search result tag list
        """
        return len(self.find_elements(self.browser, self.SEARCH_TAG_RESULT, wait))


class NoteSearchPage(Page):

    SEARCH_INPUT = (By.CSS_SELECTOR, "#top-search input.multiselect__input")
    SEARCH_RESULT_COUNT = (By.CSS_SELECTOR, "#vue-app ul[class*='note-search-result'] li")
    TOP_SEARCH_ICON = (By.CSS_SELECTOR, "#top-search-icon")

    def __init__(self, browser):
        self.browser = browser

    def top_search_icon(self):
        """
        Find the search form input
        """
        return self.browser.find_element(*self.TOP_SEARCH_ICON)

    def search_input(self):
        """
        Find the search form input
        """
        return self.browser.find_element(*self.SEARCH_INPUT)

    def search_result_count(self, wait=False):
        """
        Find the search result count
        """
        return len(self.find_elements(self.browser, self.SEARCH_RESULT_COUNT, wait))
