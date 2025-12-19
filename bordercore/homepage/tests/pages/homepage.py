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

    RECENT_BOOKMARKS = (By.CSS_SELECTOR, "ul#recent-bookmarks li")
    PINNED_BOOKMARKS = (By.CSS_SELECTOR, "li[id='pinned-bookmarks']")
    TITLE = (By.TAG_NAME, "title")
    TODO = (By.CSS_SELECTOR, "ul#important_tasks li")

    def __init__(self, browser):
        self.browser = browser

    def title_value(self):
        """
        Find the value of the title element
        """
        search_input = self.browser.find_element(*self.TITLE)
        return search_input.get_attribute("innerHTML")

    def todo_count(self):
        """
        Find all important todo tasks
        """
        todo_elements = self.browser.find_elements(*self.TODO)
        return len(todo_elements)

    def todo_item(self, item_position):
        """
        Get the todo item at the specified position
        """
        todo_elements = self.browser.find_elements(*self.TODO)
        return todo_elements[item_position].get_attribute("innerHTML")

    def bookmarks_count(self):
        """
        Find all recent bookmarks
        """
        bookmarks_elements = self.browser.find_elements(*self.RECENT_BOOKMARKS)
        return len(bookmarks_elements)

    def pinned_bookmarks_count(self):
        """
        Find all pinned bookmarks
        """
        pinned_bookmarks_elements = self.browser.find_elements(*self.PINNED_BOOKMARKS)
        return len(pinned_bookmarks_elements)
