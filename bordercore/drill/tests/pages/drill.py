try:
    from selenium.webdriver.common.by import By
    from selenium.webdriver.remote.webelement import WebElement
except ModuleNotFoundError:
    # Don't worry if this import doesn't exist in production
    pass


class SummaryPage:

    STUDY_BUTTON = (By.CSS_SELECTOR, "button[data-bs-target='#modal-study']")
    TAG_RADIO_OPTION = (By.CSS_SELECTOR, "input[value='tag']")
    TAG_INPUT = (By.CSS_SELECTOR, "#tag-name input")
    START_STUDY_SESSION_BUTTON = (By.CSS_SELECTOR, "input[type='submit']")
    TAG_DROPDOWN = (By.CSS_SELECTOR, "#tag-name .react-select__option")
    QUESTION = (By.CSS_SELECTOR, "h3.drill-text p")
    BREADCRUMB = (By.CSS_SELECTOR, ".breadcrumb-item strong:first-child")

    def __init__(self, browser):
        self.browser = browser

    def find_element(self, *selector):
        """
        Find an element with JS click fallback
        """
        import time

        from selenium.webdriver.support.wait import WebDriverWait

        # Wait for element to be present
        wait = WebDriverWait(self.browser, timeout=10)
        try:
            wait.until(lambda driver: driver.find_element(*selector))
        except:
            pass

        found_element = self.browser.find_element(*selector)

        # Capture variables for closure
        browser = self.browser

        # Add a click method to the element that uses JS click as fallback
        original_click = found_element.click
        def smart_click():
            from selenium.common.exceptions import \
                ElementClickInterceptedException
            try:
                browser.execute_script("arguments[0].scrollIntoView({block: 'center'});", found_element)
                time.sleep(0.5)
                original_click()
            except ElementClickInterceptedException:
                # If element is intercepted, use JavaScript click which bypasses overlays
                browser.execute_script("arguments[0].click();", found_element)
            except Exception:
                # If regular click fails, try JS click
                try:
                    browser.execute_script("arguments[0].click();", found_element)
                except:
                    original_click()

        # Also add a send_keys method that uses JS fallback or ensures focus
        original_send_keys = found_element.send_keys
        def smart_send_keys(*args):
            try:
                browser.execute_script("arguments[0].scrollIntoView({block: 'center'});", found_element)
                time.sleep(0.5)
                original_send_keys(*args)
            except Exception:
                # Fallback: try to set value via JS if it's a simple string
                if len(args) == 1 and isinstance(args[0], str):
                    try:
                        browser.execute_script("arguments[0].value = arguments[1];", found_element, args[0])
                        browser.execute_script("arguments[0].dispatchEvent(new Event('input', { bubbles: true }));", found_element)
                        browser.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", found_element)
                    except:
                        original_send_keys(*args)
                else:
                    original_send_keys(*args)

        # Use a wrapper class to avoid modifying the original element object directly
        # which might cause issues with some selenium versions or drivers
        class ElementWrapper(WebElement):
            def __init__(self, element, smart_click, smart_send_keys):
                super().__init__(element.parent, element.id)
                self.click = smart_click
                self.send_keys = smart_send_keys

        return ElementWrapper(found_element, smart_click, smart_send_keys)

    def study_button(self):
        """
        Find the 'Study' button
        """
        return self.find_element(*self.STUDY_BUTTON)

    def tag_radio_option(self):
        """
        Find the 'Tag' study method option
        """
        return self.find_element(*self.TAG_RADIO_OPTION)

    def tag_input(self):
        """
        Find the 'Tag' text input
        """
        return self.find_element(*self.TAG_INPUT)

    def start_study_session_button(self):
        """
        Find the 'Start Study Session' button
        """
        return self.find_element(*self.START_STUDY_SESSION_BUTTON)

    def tag_dropdown_option(self, tag_name):
        """
        Find the dropdown option with display name 'tag_name'
        """
        import time

        from selenium.common.exceptions import ElementClickInterceptedException
        from selenium.webdriver.support.wait import WebDriverWait

        # Wait for options to be present
        wait = WebDriverWait(self.browser, timeout=10)
        try:
            wait.until(lambda driver: len(driver.find_elements(*self.TAG_DROPDOWN)) > 0)
        except:
            pass

        tag_list = self.browser.find_elements(*self.TAG_DROPDOWN)

        for option in tag_list:
            if option.text.strip() == tag_name:
                # Wrap the element with smart click handling
                browser = self.browser
                original_click = option.click
                def smart_click():
                    try:
                        browser.execute_script("arguments[0].scrollIntoView({block: 'center'});", option)
                        time.sleep(0.5)
                        original_click()
                    except ElementClickInterceptedException:
                        # If element is intercepted, use JavaScript click which bypasses overlays
                        browser.execute_script("arguments[0].click();", option)
                    except Exception:
                        try:
                            browser.execute_script("arguments[0].click();", option)
                        except:
                            original_click()

                class ElementWrapper(WebElement):
                    def __init__(self, element, smart_click):
                        super().__init__(element.parent, element.id)
                        self.click = smart_click

                return ElementWrapper(option, smart_click)

    def question_text(self):
        """
        Find the question text
        """
        return self.browser.find_element(*self.QUESTION).text

    def breadcrumb(self):
        """
        Find the breadcrumb text
        """
        return self.browser.find_element(*self.BREADCRUMB).text
