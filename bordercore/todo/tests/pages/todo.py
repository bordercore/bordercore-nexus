try:
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import Select
    import time
except ModuleNotFoundError:
    # Don't worry if this import doesn't exist in production
    pass


class TodoPage:

    TITLE = (By.TAG_NAME, "title")
    TODO_ELEMENTS = (By.CSS_SELECTOR, "div.todo-list div.todo-row")
    FIRST_TASK = (By.CSS_SELECTOR, "div.todo-row .todo-row-title > span")
    NO_TASKS = (By.CSS_SELECTOR, "div.todo-empty")
    SORT_SELECT = (By.CSS_SELECTOR, "select.refined-select")
    LOW_PRIORITY_FILTER = (
        By.XPATH,
        "//div[contains(@class,'refined-side-group')][.//h3[normalize-space()='Priority']]"
        "//button[contains(@class,'refined-side-item')]"
        "[.//span[contains(@class,'text') and normalize-space()='Low']]",
    )

    def __init__(self, browser):
        self.browser = browser

    def title_value(self):
        """
        Find the value of the title element
        """
        element = self.browser.find_element(*self.TITLE)
        return element.get_attribute("innerHTML")

    def todo_count(self):
        """
        Find all todo tasks.
        Returns 1 if the empty-state message is present, otherwise returns
        count of rendered todo rows.
        """
        todo_elements = self.browser.find_elements(*self.TODO_ELEMENTS)
        if len(todo_elements) == 0:
            no_tasks_elements = self.browser.find_elements(*self.NO_TASKS)
            if len(no_tasks_elements) > 0 and no_tasks_elements[0].text.strip():
                return 1
        return len(todo_elements)

    def todo_task_text(self):
        """
        Find the name text of the first task
        """
        todo_element = self.browser.find_elements(*self.FIRST_TASK)
        return todo_element[0].text

    def todo_no_tasks_text(self):
        """
        Find the text of the empty-state element
        """
        todo_element = self.browser.find_elements(*self.NO_TASKS)
        return todo_element[0].text

    def sort_by_priority(self):
        sort_select = Select(self.browser.find_element(*self.SORT_SELECT))
        sort_select.select_by_value("priority")

        # Wait for the re-sort to apply
        time.sleep(0.5)

        todo_element = self.browser.find_elements(*self.FIRST_TASK)
        return todo_element[0].text

    def click_low_priority_filter(self):
        """
        Click the Low priority filter in the sidebar.

        The sticky sidebar nav overlaps the button at its native position, so
        drive the click through JavaScript to bypass the occluding element.
        """
        element = self.browser.find_element(*self.LOW_PRIORITY_FILTER)
        self.browser.execute_script("arguments[0].click();", element)
