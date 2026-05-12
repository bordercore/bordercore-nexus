"""Tests for metrics.services.parse_pytest_output."""
from metrics.services import parse_pytest_output


SAMPLE = """============================= test session starts ==============================
platform linux -- Python 3.13.7, pytest-9.0.3, pluggy-1.6.0
rootdir: /var/www/django/bordercore
plugins: cov-6.2.1, anyio-4.12.1, xdist-3.8.0, Faker-40.4.0
created: 3/3 workers

.......F.......................................                          [100%]
=================================== FAILURES ===================================
___________________________ test_books_with_contents ___________________________
[gw2] linux -- Python 3.13.7 /var/www/django/bordercore/.venv/bin/python3

self = <DatabaseWrapper vendor='postgresql' alias='default'>

>   foo = bar()
E   psycopg_pool.PoolTimeout: couldn't get a connection after 10.00 sec

bordercore/blob/tests/test_data.py:292: PoolTimeout
.venv/lib/python3.13/site-packages/django/db/backends/base/base.py:279: in connect
    self.connect()
=========================== short test summary info ============================
FAILED bordercore/blob/tests/test_data.py::test_books_with_contents - django....
=================== 1 failed, 46 passed in 329.22s (0:05:29) ===================
"""


def test_empty_input_returns_empty():
    result = parse_pytest_output("")
    assert result == {"tokens": [], "summary": {}}


def test_summary_parses_counts_and_duration():
    result = parse_pytest_output(SAMPLE)
    s = result["summary"]
    assert s["failed"] == 1
    assert s["passed"] == 46
    assert s["total"] == 47
    assert s["duration_seconds"] == 329.22
    assert s["duration_pretty"] == "0:05:29"


def _kinds(tokens):
    """Helper: drop newlines + blanks so assertions read against meaningful tokens."""
    return [t["kind"] for t in tokens if t["text"] != "\n" and t["kind"] != "blank"]


def test_banners_failure_headers_and_dividers_are_classified():
    kinds = _kinds(parse_pytest_output(SAMPLE)["tokens"])
    # The opening "test session starts" banner is the first non-blank token.
    assert kinds[0] == "banner"
    assert "failure-header" in kinds
    # The final "1 failed, 46 passed" line is re-tagged as "result", not "banner".
    assert kinds[-1] == "result"


def test_error_and_code_pointer_lines_are_classified():
    kinds = _kinds(parse_pytest_output(SAMPLE)["tokens"])
    assert "error" in kinds
    assert "code-pointer" in kinds


def test_frame_vendor_vs_project():
    kinds = _kinds(parse_pytest_output(SAMPLE)["tokens"])
    assert "frame-project" in kinds  # bordercore/blob/tests/test_data.py:292:
    assert "frame-vendor" in kinds   # .venv/lib/.../base.py:279: in connect


def test_summary_failed_line_is_classified():
    kinds = _kinds(parse_pytest_output(SAMPLE)["tokens"])
    assert "summary-failed" in kinds


def test_progress_line_emits_per_char_tokens():
    tokens = parse_pytest_output(SAMPLE)["tokens"]
    progress = [t for t in tokens if t["kind"].startswith("prog-")]
    # 47 outcome chars in the sample's progress run.
    assert sum(1 for t in progress if t["kind"] == "prog-pass") == 46
    assert sum(1 for t in progress if t["kind"] == "prog-fail") == 1


def test_unknown_lines_fall_through_as_text():
    result = parse_pytest_output("just a normal line\n")
    kinds = [t["kind"] for t in result["tokens"]]
    assert "text" in kinds


def test_no_result_banner_yields_empty_summary():
    # Aborted run: no "=== 1 failed, ... ===" line.
    raw = "============================= test session starts ==============================\nplatform linux\n"
    result = parse_pytest_output(raw)
    assert result["summary"] == {}
    # But tokens still classify the banner.
    assert result["tokens"][0]["kind"] == "banner"
