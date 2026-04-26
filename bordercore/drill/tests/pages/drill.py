try:
    import time

    from selenium.common.exceptions import ElementClickInterceptedException
    from selenium.webdriver.common.by import By
    from selenium.webdriver.remote.webelement import WebElement
    from selenium.webdriver.support.wait import WebDriverWait
except ModuleNotFoundError:
    # Don't worry if this import doesn't exist in production
    pass


def _wrap_element(browser, element):
    """Wrap a Selenium WebElement with JS-fallback click and send_keys."""
    original_click = element.click
    original_send_keys = element.send_keys

    def smart_click():
        try:
            browser.execute_script(
                "arguments[0].scrollIntoView({block: 'center'});", element
            )
            time.sleep(0.5)
            original_click()
        except ElementClickInterceptedException:
            browser.execute_script("arguments[0].click();", element)
        except Exception:
            try:
                browser.execute_script("arguments[0].click();", element)
            except Exception:
                original_click()

    def smart_send_keys(*args):
        try:
            browser.execute_script(
                "arguments[0].scrollIntoView({block: 'center'});", element
            )
            time.sleep(0.5)
            original_send_keys(*args)
        except Exception:
            if len(args) == 1 and isinstance(args[0], str):
                try:
                    browser.execute_script(
                        "arguments[0].value = arguments[1];", element, args[0]
                    )
                    browser.execute_script(
                        "arguments[0].dispatchEvent(new Event('input', { bubbles: true }));",
                        element,
                    )
                    browser.execute_script(
                        "arguments[0].dispatchEvent(new Event('change', { bubbles: true }));",
                        element,
                    )
                except Exception:
                    original_send_keys(*args)
            else:
                original_send_keys(*args)

    class ElementWrapper(WebElement):
        def __init__(self, el, click_fn, send_keys_fn):
            super().__init__(el.parent, el.id)
            self.click = click_fn
            self.send_keys = send_keys_fn

    return ElementWrapper(element, smart_click, smart_send_keys)


class SummaryPage:

    QUESTION = (By.CSS_SELECTOR, ".q-prompt p")
    BREADCRUMB = (By.CSS_SELECTOR, ".drill-path .leaf")

    def __init__(self, browser):
        self.browser = browser

    def find_element(self, *selector):
        """Find an element with JS click fallback."""
        wait = WebDriverWait(self.browser, timeout=10)
        try:
            wait.until(lambda driver: driver.find_element(*selector))
        except Exception:
            pass

        found_element = self.browser.find_element(*selector)
        return _wrap_element(self.browser, found_element)

    def tag_row(self, tag_name):
        """Find the tag-row link in the 'Tags needing review' table for tag_name."""
        selector = (
            By.CSS_SELECTOR,
            f'a.drill-tag-row[href*="study_method=tag&tags={tag_name}"]',
        )
        return self.find_element(*selector)

    def question_text(self):
        """Find the question text."""
        return self.find_element(*self.QUESTION).text

    def breadcrumb(self):
        """Find the breadcrumb text."""
        return self.find_element(*self.BREADCRUMB).text
