"""Browser regression checks against synthetic lessons; no paid API requests."""

import json

import pytest
from lumen import generation, services
from lumen.models import GenerationJob, LessonVersion
from lumen.tests.test_lumen import PAYLOAD
from selenium.common.exceptions import (
    NoSuchFrameException,
    NoSuchWindowException,
    StaleElementReferenceException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait

from django.urls import reverse

from accounts.tests.factories import UserFactory
from drill.tests.factories import QuestionFactory

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.functional]


def test_offline_math_rendering(browser):
    from urllib.parse import quote

    from lumen.math import with_math
    from lumen.themes import themed_html

    html = generation.assemble_html(
        {"html": r'''<!doctype html><html><head><style>svg{width:100%;height:auto}</style></head><body>
        <p id="tex">\(p = \frac{1}{2}\)</p>
        <div id="display">\[x_i^2 + \sqrt{y}\]</div>
        <code id="legacy">(1 − 1/m)^(kn) ≈ e^(−kn/m)</code>
        <span class="formula">p ≈ (1 − e^(−kn/m))^k
best k ≈ (m/n)·ln 2 → p_min ≈ 0.6185^(m/n)
bits needed m ≈ −n·ln p / (ln 2)²</span>
        <pre><code id="program">const x = 2;</code></pre>
        <p id="money">Costs $5 and $10.</p>
        <button onclick="this.textContent='Working'">Try</button>
        </body></html>''', "followups": [
            {"question": r"What is \(x^2\)?", "answer": r"\(x \times x\)"}
        ]},
        {"question": "Q", "answer": "A"},
    )
    browser.get("data:text/html;charset=utf-8," + quote(with_math(themed_html(html, "midnight-scholar"))))
    wait = WebDriverWait(browser, 20)
    wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, "#tex mjx-container svg")) == 1)
    assert len(browser.find_elements(By.CSS_SELECTOR, "#display mjx-container svg")) == 1
    assert len(browser.find_elements(By.CSS_SELECTOR, ".formula mjx-container")) == 3
    assert len(browser.find_elements(By.CSS_SELECTOR, "#legacy mjx-container")) == 1
    assert browser.find_element(By.CSS_SELECTOR, "#legacy mjx-container svg").rect["height"] < 100
    assert len(browser.find_elements(By.CSS_SELECTOR, "#lumen-review mjx-container")) == 2
    assert browser.find_element(By.ID, "program").text == "const x = 2;"
    assert browser.find_element(By.ID, "money").text == "Costs $5 and $10."
    assert not browser.find_elements(By.CSS_SELECTOR, "[data-mjx-error]")
    browser.find_element(By.TAG_NAME, "button").click()
    assert browser.find_element(By.TAG_NAME, "button").text == "Working"
    assert browser.execute_script("return performance.getEntriesByType('resource').length") == 0


def test_create_read_theme_and_sandbox(
    browser, live_server, client, settings, monkeypatch
):
    settings.DEBUG = True
    settings.VITE_USE_MANIFEST = True
    settings.LUMEN_GENERATION_ENABLED = True
    monkeypatch.setenv("ANTHROPIC_API_KEY", "browser-test-key")
    monkeypatch.setattr(
        generation,
        "generate",
        lambda *_: json.dumps(
            {
                **PAYLOAD,
                "accuracy": {
                    "status": "issues",
                    "explanation": "Pressure divides force by area.",
                    "question": "Why does area reduce pressure?",
                    "answer": "P = F/A",
                },
            }
        ),
    )
    monkeypatch.setattr(generation, "model_catalog", lambda *_: {"models": []})
    user = UserFactory(username="lumen-browser")
    question = QuestionFactory(
        user=user, question="Why does area reduce pressure?", answer="P = F * A"
    )
    client.force_login(user)
    browser.set_window_size(1440, 1100)
    browser.get(live_server.url + reverse("accounts:login"))
    browser.add_cookie(
        {
            "name": settings.SESSION_COOKIE_NAME,
            "value": client.cookies[settings.SESSION_COOKIE_NAME].value,
            "path": "/",
        }
    )
    wait = WebDriverWait(
        browser,
        25,
        ignored_exceptions=(
            NoSuchWindowException,
            NoSuchFrameException,
            StaleElementReferenceException,
        ),
    )
    browser.get(
        live_server.url + reverse("lumen:index") + "?question=" + str(question.uuid)
    )
    button = wait.until(
        lambda d: d.find_element(By.CSS_SELECTOR, ".lumen-create button")
    )
    wait.until(lambda _: button.is_enabled())
    button.click()
    wait.until(lambda _: GenerationJob.objects.filter(user=user).exists())
    services.run_job(services.claim_job())
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, "iframe"))
    lesson = LessonVersion.objects.get(user=user)
    reader_handle = browser.current_window_handle
    frame = browser.find_element(By.CSS_SELECTOR, "iframe")
    browser.execute_script("arguments[0].scrollIntoView({block: 'center'});", frame)
    browser.switch_to.frame(frame)
    wait.until(lambda d: d.find_elements(By.ID, "example"))
    wait.until(lambda d: d.execute_script("return document.readyState") == "complete")
    browser.find_element(By.ID, "example").click()
    wait.until(lambda d: d.find_element(By.ID, "pressure").text == "20 Pa")
    assert browser.find_element(By.ID, "pressure").text == "20 Pa"
    assert (
        browser.execute_script(
            "try { return parent.document.cookie; } catch(e) { return 'isolated'; }"
        )
        == "isolated"
    )
    assert (
        browser.execute_async_script(
            "const done=arguments[0]; fetch('/lumen/api/preferences/').then(()=>done('allowed')).catch(()=>done('blocked'));"
        )
        == "blocked"
    )
    browser.switch_to.default_content()
    browser.find_element(
        By.XPATH, "//button[normalize-space()='Correct original question and answer']"
    ).click()
    wait.until(
        lambda d: d.find_elements(
            By.XPATH, "//*[text()='Correction applied to the original drill.']"
        )
    )
    question.refresh_from_db()
    assert question.answer == "P = F/A"
    lesson.refresh_from_db()
    assert lesson.source["answer"] == "P = F * A"
    browser.save_screenshot("/tmp/lumen-integrated-reader.png")
    browser.find_element(By.LINK_TEXT, "Lesson theme ↗").click()
    wait.until(lambda d: len(d.window_handles) == 2)
    browser.switch_to.window(
        [h for h in browser.window_handles if h != reader_handle][0]
    )
    select = wait.until(lambda d: d.find_element(By.ID, "id_lumen_theme"))
    Select(select).select_by_value("neon-circuit")
    wait.until(
        lambda d: d.execute_script(
            "const b=document.querySelector('[data-testid=prefs-save]'); const r=b.getBoundingClientRect(); return !b.disabled && r.top >= 0 && r.bottom <= innerHeight;"
        )
    )
    browser.find_element(By.CSS_SELECTOR, '[data-testid="prefs-save"]').click()

    def saved(_):
        user.userprofile.refresh_from_db()
        return user.userprofile.lumen_theme == "neon-circuit"

    wait.until(saved)
    assert user.userprofile.theme == "light"
    browser.save_screenshot("/tmp/lumen-integrated-preferences.png")
    browser.close()
    browser.switch_to.window(reader_handle)

    def has_theme(driver):
        driver.switch_to.window(reader_handle)
        driver.switch_to.default_content()
        driver.switch_to.frame(driver.find_element(By.CSS_SELECTOR, "iframe"))
        found = driver.find_elements(
            By.CSS_SELECTOR, '#lumen-lesson-theme[data-style="neon-circuit"]'
        )
        driver.switch_to.default_content()
        return bool(found)

    wait.until(has_theme)
    assert LessonVersion.objects.count() == 1
    lesson.refresh_from_db()
    assert 'id="lumen-lesson-theme"' not in lesson.html
    browser.refresh()
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, "iframe"))
    frame = browser.find_element(By.CSS_SELECTOR, "iframe")
    browser.execute_script("arguments[0].scrollIntoView({block: 'center'});", frame)
    browser.switch_to.frame(frame)
    wait.until(lambda d: d.find_elements(By.ID, "example"))
    wait.until(lambda d: d.execute_script("return document.readyState") == "complete")
    browser.find_element(By.ID, "example").click()
    wait.until(lambda d: d.find_element(By.ID, "pressure").text == "20 Pa")
    assert browser.find_element(By.ID, "pressure").text == "20 Pa"
    browser.switch_to.default_content()
    # A direct document visit still gets the response-header sandbox.
    browser.get(live_server.url + reverse("lumen:html", args=[lesson.pk]))
    assert (
        browser.execute_script(
            "try { document.cookie; return 'allowed'; } catch(e) { return 'isolated'; }"
        )
        == "isolated"
    )
