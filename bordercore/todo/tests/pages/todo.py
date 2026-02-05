try:
    from selenium.webdriver.common.by import By
    import time
except ModuleNotFoundError:
    # Don't worry if this import doesn't exist in production
    pass


class TodoPage:

    TITLE = (By.TAG_NAME, "title")
    TODO_ELEMENTS = (By.CSS_SELECTOR, "div.todo-grid-body div.todo-grid-row")
    FIRST_TASK = (By.CSS_SELECTOR, "div.todo-grid-row div.todo-col-name")
    NO_TASKS = (By.CSS_SELECTOR, "div#react-root .text-center.p-3")
    PRIORITY_COLUMN = (By.CSS_SELECTOR, "div.todo-grid-header div.todo-col-priority")
    LOW_PRIORITY_FILTER = (By.CSS_SELECTOR, "div[data-priority='3']")

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
        Find all todo tasks bookmarks.
        Returns 1 if "No tasks found" message is present, otherwise returns count of table rows.
        """
        todo_elements = self.browser.find_elements(*self.TODO_ELEMENTS)
        if len(todo_elements) == 0:
            # Check if "No tasks found" message is present
            no_tasks_elements = self.browser.find_elements(*self.NO_TASKS)
            if len(no_tasks_elements) > 0 and "No tasks found" in no_tasks_elements[0].text:
                return 1
        return len(todo_elements)

    def todo_task_text(self):
        """
        Find the text of the first ask
        """
        todo_element = self.browser.find_elements(*self.FIRST_TASK)
        return todo_element[0].text

    def todo_no_tasks_text(self):
        """
        Find the text of the first ask
        """
        todo_element = self.browser.find_elements(*self.NO_TASKS)
        return todo_element[0].text

    def sort_by_priority(self):

        priority_column = self.browser.find_element(*self.PRIORITY_COLUMN)
        priority_column.click()

        todo_element = self.browser.find_elements(*self.FIRST_TASK)
        return todo_element[0].text

    def low_priority_filter(self):
        """
        Find the low priority filter element and scroll it into view to avoid click interception
        """
        todo_element = self.browser.find_elements(*self.LOW_PRIORITY_FILTER)
        element = todo_element[0]
        # Scroll into view to avoid click interception
        self.browser.execute_script("arguments[0].scrollIntoView(true);", element)
        time.sleep(0.5)  # Brief wait for scroll
        return element
