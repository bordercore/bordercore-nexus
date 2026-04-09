try:
    from selenium.webdriver.common.by import By
    import time
except ModuleNotFoundError:
    # Don't worry if this import doesn't exist in production
    pass


class TodoPage:

    TITLE = (By.TAG_NAME, "title")
    TODO_ELEMENTS = (By.CSS_SELECTOR, "div.todo-cards div.todo-card")
    FIRST_TASK = (By.CSS_SELECTOR, "div.todo-card .todo-task-name")
    NO_TASKS = (By.CSS_SELECTOR, "div#react-root .todo-empty-state")
    SORT_DROPDOWN_TRIGGER = (By.CSS_SELECTOR, "div.todo-sort-dropdown div.dropdown-trigger")
    PRIORITY_SORT_OPTION = (
        By.XPATH,
        "//div[contains(@class,'popover-floating')]"
        "//button[contains(@class,'dropdown-menu-item')]"
        "[.//span[contains(@class,'dropdown-menu-text') and normalize-space()='Priority']]",
    )
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
        Find the name text of the first task
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

        # Open the sort dropdown menu
        sort_trigger = self.browser.find_element(*self.SORT_DROPDOWN_TRIGGER)
        sort_trigger.click()

        # Wait for the popover to mount and the transition to complete
        time.sleep(0.5)

        # Click the "Priority" option in the dropdown
        priority_option = self.browser.find_element(*self.PRIORITY_SORT_OPTION)
        priority_option.click()

        # Wait for the re-sort to apply
        time.sleep(0.5)

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
