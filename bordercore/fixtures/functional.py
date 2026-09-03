import getpass
import os

import pytest

try:
    from selenium import webdriver
    from selenium.webdriver.firefox.options import Options as FirefoxOptions
    from selenium.webdriver.firefox.service import Service

    from homepage.tests.pages.homepage import LoginPage
except (ModuleNotFoundError, NameError):
    pass

GECKO_DRIVER_LOGFILE = f"/tmp/geckodriver-{getpass.getuser()}.log"


@pytest.fixture(scope="session")
def browser():
    # Always run Firefox headless. Xvfb was removed from the cron path after the
    # Aug 2026 mesa upgrade broke non-headless Firefox under virtual displays
    # ([GFX1-]: RenderCompositorSWGL failed mapping default framebuffer), and
    # modern Firefox headless doesn't need Xvfb anyway.
    firefox_options = FirefoxOptions()
    firefox_options.add_argument("--headless")

    service = Service(executable_path="/snap/bin/geckodriver", log_path=GECKO_DRIVER_LOGFILE)
    driver = webdriver.Firefox(service=service, options=firefox_options)

    yield driver

    driver.quit()


@pytest.fixture()
def login(authenticated_client, live_server, browser, settings, request):
    settings.DEBUG = True
    os.environ["DISABLE_DEBUG_TOOLBAR"] = "1"
    # Use built Vite assets so React apps load from live_server (no dev server needed)
    settings.VITE_USE_MANIFEST = True

    authenticated_client()

    page = LoginPage(browser)
    page.load(live_server, request.param)
    page.login()
