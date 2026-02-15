import getpass
import os

import pytest

try:
    from pyvirtualdisplay import Display
    from selenium import webdriver
    from selenium.webdriver.firefox.options import Options as FirefoxOptions
    from selenium.webdriver.firefox.service import Service

    from homepage.tests.pages.homepage import LoginPage
except (ModuleNotFoundError, NameError):
    pass

GECKO_DRIVER_LOGFILE = f"/tmp/geckodriver-{getpass.getuser()}.log"


@pytest.fixture(scope="session")
def browser():

    display = None
    use_headless = False
    if not os.environ.get("DISABLE_HEADLESS_DISPLAY", None):
        try:
            # Set screen resolution to 1366 x 768 like most 15" laptops
            display = Display(visible=0, size=(1366, 768))
            display.start()
        except Exception:
            # If Xvfb is not installed or display fails to start, use Firefox headless mode
            # This allows tests to run in environments without a display (e.g., cron)
            # Silently fall back to headless mode - this is expected behavior
            display = None
            use_headless = True
    else:
        # If DISABLE_HEADLESS_DISPLAY is set, we might still need headless mode
        # Check if DISPLAY is not set (common in cron environments)
        if not os.environ.get("DISPLAY"):
            use_headless = True

    # Configure Firefox options
    firefox_options = FirefoxOptions()
    if use_headless:
        firefox_options.add_argument("--headless")

    service = Service(executable_path="/snap/bin/geckodriver", log_path=GECKO_DRIVER_LOGFILE)
    driver = webdriver.Firefox(service=service, options=firefox_options)

    yield driver

    if display is not None:
        # Quit the Xvfb display if it was started
        display.stop()

    driver.quit()


@pytest.fixture()
def login(auto_login_user, live_server, browser, settings, request):
    settings.DEBUG = True
    os.environ["DISABLE_DEBUG_TOOLBAR"] = "1"
    # Use built Vite assets so React apps load from live_server (no dev server needed)
    settings.VITE_USE_MANIFEST = True

    auto_login_user()

    page = LoginPage(browser)
    page.load(live_server, request.param)
    page.login()
