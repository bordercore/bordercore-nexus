try:
    import time

    from selenium.common.exceptions import (NoSuchElementException,
                                            StaleElementReferenceException)
    from selenium.webdriver.remote.webelement import WebElement
    from selenium.webdriver.support.wait import WebDriverWait
except (ModuleNotFoundError, NameError):
    # Don't worry if these imports don't exist in production
    pass


class Page:

    def find_element(self, element, selector, wait=False):
        if wait:
            def _find_in_container(driver):
                try:
                    return element.find_element(*selector)
                except (NoSuchElementException, StaleElementReferenceException):
                    return False
            wait = WebDriverWait(self.browser, timeout=10)
            result = wait.until(_find_in_container)
            if result is False:
                raise NoSuchElementException(f"Element not found: {selector}")
            found_element = result
        else:
            # Use a loop to wait for the element to be clickable and not obscured
            wait = WebDriverWait(self.browser, timeout=10)
            from selenium.webdriver.support import expected_conditions as EC

            try:
                wait.until(EC.element_to_be_clickable(selector))
            except:
                pass

            found_element = element.find_element(*selector)

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
                # Try to wait for any obscuring elements to disappear
                try:
                    wait.until(EC.element_to_be_clickable(found_element))
                except:
                    pass
                original_click()
            except ElementClickInterceptedException:
                # If element is intercepted, use JavaScript click which bypasses overlays
                browser.execute_script("arguments[0].click();", found_element)
            except Exception:
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
        class ElementWrapper(WebElement):
            def __init__(self, element, smart_click, smart_send_keys):
                super().__init__(element.parent, element.id)
                self.click = smart_click
                self.send_keys = smart_send_keys

        return ElementWrapper(found_element, smart_click, smart_send_keys)

    def find_elements(self, element, selector, wait=False):
        if wait:
            def _find_in_container(driver):
                try:
                    elements = element.find_elements(*selector)
                    return elements if len(elements) > 0 else False
                except (NoSuchElementException, StaleElementReferenceException):
                    return False
            wait = WebDriverWait(self.browser, timeout=10)
            wait.until(_find_in_container)
        return element.find_elements(*selector)

    def element_has_focus(self, element, selector):
        try:
            active_element = self.browser.switch_to.active_element
            target_element = element.find_element(*selector)
            return active_element == target_element
        except:
            return False

    def wait_for_focus(self, element, selector):
        wait = WebDriverWait(self.browser, timeout=10)
        wait.until(lambda driver: self.element_has_focus(element, selector))
