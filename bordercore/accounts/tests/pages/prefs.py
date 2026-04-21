import time

from selenium.webdriver.support.ui import Select
from selenium.webdriver.support.wait import WebDriverWait

from django.urls import reverse

try:
    from selenium.webdriver.common.by import By
except ModuleNotFoundError:
    # Don't worry if this import doesn't exist in production
    pass

from test_page import Page


class PrefsPage(Page):

    URL = reverse("accounts:prefs")

    TITLE = (By.TAG_NAME, "title")
    COLLECTION_ID = (By.ID, "id_homepage_default_collection")
    UPDATE_BUTTON = (By.CSS_SELECTOR, "button[data-testid='prefs-save']")
    THEME_SELECTED = (By.CSS_SELECTOR, "button.prefs-theme-card.selected")
    SAVED_MESSAGE = (By.CSS_SELECTOR, ".prefs-savebar .msg")
    DEFAULT_COLLECTION_SELECTED = (By.CSS_SELECTOR, "select#id_homepage_default_collection option")

    def __init__(self, browser):
        self.browser = browser

    def load(self, live_server):
        self.browser.get(f"{live_server.url}{self.URL}")

    def title_value(self):
        """
        Find the value of the title element
        """
        search_input = self.browser.find_element(*self.TITLE)
        return search_input.get_attribute("innerHTML")

    def choose_theme(self, theme_css_id):
        """
        Select a theme by clicking the matching theme card.
        """
        card = self.browser.find_element(
            By.CSS_SELECTOR, f"button.prefs-theme-card[data-theme='{theme_css_id}']"
        )
        self.browser.execute_script("arguments[0].scrollIntoView();", card)
        card.click()

    def choose_default_collection(self, collection_name):
        """
        Select a 'Default collection'
        """
        select = Select(self.browser.find_element(*self.COLLECTION_ID))
        select.select_by_visible_text(collection_name)

    def selected_theme(self):
        """
        Return the CSS ID (value attribute) of the selected theme card.
        """
        selected_card = self.browser.find_element(*self.THEME_SELECTED)
        return selected_card.get_attribute("data-theme")

    def selected_default_collection(self):
        options = self.browser.find_elements(*self.DEFAULT_COLLECTION_SELECTED)
        return [x for x in options if x.is_selected()][0].text

    def update(self):
        """
        Click the 'save changes' button in the save bar.
        """
        update_input = self.browser.find_element(*self.UPDATE_BUTTON)
        self.browser.execute_script("arguments[0].scrollIntoView();", update_input)
        time.sleep(1)
        update_input.click()

    def prefs_updated_message(self):
        """
        Read the save bar's confirmation message after saving.
        """
        wait = WebDriverWait(self.browser, timeout=10)
        wait.until(
            lambda driver: "saved" in driver.find_element(*self.SAVED_MESSAGE).text.lower()
        )
        message = self.browser.find_element(*self.SAVED_MESSAGE)
        return message.text
