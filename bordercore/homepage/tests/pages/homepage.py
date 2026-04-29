from accounts.tests.factories import TEST_PASSWORD, TEST_USERNAME

try:
    from selenium.webdriver.common.by import By
except ModuleNotFoundError:
    # Don't worry if this import doesn't exist in production
    pass


class LoginPage:

    USERNAME_INPUT = (By.NAME, "username")
    PASSWORD_INPUT = (By.NAME, "password")
    SUBMIT_BUTTON = (By.CSS_SELECTOR, "button[type='submit']")

    def __init__(self, browser):
        self.browser = browser

    def load(self, live_server, url="/"):
        self.browser.get(f"{live_server.url}/accounts/login/?next={url}")

    def login(self):
        username_input = self.browser.find_element(*self.USERNAME_INPUT)
        username_input.clear()
        username_input.send_keys(TEST_USERNAME)
        password_input = self.browser.find_element(*self.PASSWORD_INPUT)
        password_input.clear()
        password_input.send_keys(TEST_PASSWORD)
        submit_button = self.browser.find_element(*self.SUBMIT_BUTTON)
        submit_button.click()


class HomePage:
    """Page object for the Magazine-style homepage."""

    TITLE = (By.TAG_NAME, "title")
    TASKS = (By.CSS_SELECTOR, ".mag-tasks .mag-task")
    TASKS_EMPTY = (By.CSS_SELECTOR, ".mag-section .mag-empty")
    RECENT_BOOKMARKS = (By.CSS_SELECTOR, ".mag-classifieds .mag-bm-row")

    def __init__(self, browser):
        self.browser = browser

    def title_value(self):
        return self.browser.find_element(*self.TITLE).get_attribute("innerHTML")

    def todo_count(self):
        return len(self.browser.find_elements(*self.TASKS))

    def todo_empty_text(self):
        """Return the text of the tasks empty-state element, or None if not present."""
        elements = self.browser.find_elements(*self.TASKS_EMPTY)
        return elements[0].text if elements else None

    def bookmarks_count(self):
        return len(self.browser.find_elements(*self.RECENT_BOOKMARKS))
