try:
    from selenium.webdriver.common.by import By
except ModuleNotFoundError:
    # Don't worry if this import doesn't exist in production
    pass

from test_page import Page


class NodeListPage(Page):

    TITLE = (By.TAG_NAME, "title")
    NODE_DETAIL_LINK = (By.CSS_SELECTOR, "a[data-name='node_0']")
    COLLECTION_MENU = (By.CSS_SELECTOR, "div.hover-reveal-target")
    DROPDOWN_MENU_CONTAINER = (By.CSS_SELECTOR, "div[class*='dropdown-menu-container']")
    MENU_ITEM = (By.CSS_SELECTOR, "li a.dropdown-item")
    SELECT_OBJECT_MODAL = (By.CSS_SELECTOR, "div#modalObjectSelect_objectSelectCollection")
    RECENT_ITEMS = (By.CSS_SELECTOR, "ul.multiselect__content li.multiselect__element")
    SEARCH_INPUT = (By.CSS_SELECTOR, "input.multiselect__input")
    SEARCH_SUGGESTION_FIRST = (By.CSS_SELECTOR, "div[class*='object-select-suggestion'] div:nth-child(2) div")
    CHECKBOX_BOOKMARKS = (By.CSS_SELECTOR, "label[data-filter-type='bookmarks'] input")
    CHECKBOX_BLOBS = (By.CSS_SELECTOR, "label[data-filter-type='blobs'] input")
    SEARCH_SUGGESTION_LIST = (By.CSS_SELECTOR, "ul div[class*='object-select-suggestion']")

    def __init__(self, browser):
        self.browser = browser

    def title_value(self):
        """
        Find the value of the title element
        """
        element = self.browser.find_element(*self.TITLE)
        return element.get_attribute("innerHTML")

    def node_detail_link(self):
        """
        Find the link to the node detail page
        """

        return self.browser.find_element(*self.NODE_DETAIL_LINK)

    def collection_menu(self):
        """
        Find the collection menu
        """

        return self.browser.find_element(*self.COLLECTION_MENU)

    def dropdown_menu_container(self, element):
        """
        Find the dropdown menu container
        """

        return element.find_element(*self.DROPDOWN_MENU_CONTAINER)

    def menu_item(self, element):
        """
        Find the "Add Object" menu item
        """

        return element.find_element(*self.MENU_ITEM)

    def select_object_modal(self):
        """
        Find the "Add Object" modal
        """

        return self.browser.find_element(*self.SELECT_OBJECT_MODAL)

    def recent_items(self, element):
        """
        Find the "Add Object" menu item
        """

        return element.find_elements(*self.RECENT_ITEMS)

    def search_input(self, element):
        """
        Find the search input field
        """

        return element.find_element(*self.SEARCH_INPUT)

    def search_suggestion_first(self, element, wait=False):
        """
        Find the first search suggestion
        """
        return self.find_element(element, self.SEARCH_SUGGESTION_FIRST, wait)

    def checkbox_bookmarks(self, element):
        """
        Find the checkbox that filters on bookmarks
        """

        return element.find_element(*self.CHECKBOX_BOOKMARKS)

    def checkbox_blobs(self, element):
        """
        Find the checkbox that filters on blobs
        """

        return element.find_element(*self.CHECKBOX_BLOBS)

    def search_suggestion_list(self, element):
        """
        Find the list of search suggestion
        """
        return self.find_elements(element, self.SEARCH_SUGGESTION_LIST)
