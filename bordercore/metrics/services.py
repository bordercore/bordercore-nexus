"""Services for the metrics app.

parse_pytest_output() converts raw pytest console output into a structured
form suitable for client-side rendering: a per-line token stream plus a
summary header parsed from the final result banner. The frontend uses
these to render a colored, monospaced log without parsing anything itself.
"""
from __future__ import annotations

import re
from typing import Any

# Banner-style lines pytest emits as section headers. A banner is at least
# three of the divider char on each side of a title, e.g.
#   "============================= test session starts =============================="
#   "_______________ test_books_with_contents _______________"
#   "------------- generated xml file: /tmp/test_report-...xml -----"
# We don't capture the title — only line-type classification matters here.
_RE_BANNER_EQ = re.compile(r"^={3,}\s+.+?\s+={3,}\s*$")
_RE_BANNER_US = re.compile(r"^_{3,}\s+.+?\s+_{3,}\s*$")
_RE_BANNER_DASH = re.compile(r"^-{3,}\s+.+?\s+-{3,}\s*$")

# Progress line: a run of pytest progress chars (with optional whitespace)
# followed by "[NN%]". The chars themselves get colorized per-character so
# a glance at the modal shows where in the run things went wrong.
_RE_PROGRESS = re.compile(r"^[.FEsxX\s]+\[\s*\d+%\]\s*$")

# File:line frame marker. Pytest emits these in two forms:
#   "bordercore/foo.py:42:"                  — bare
#   "bordercore/foo.py:42: in helper"        — at an entered frame
#   "bordercore/foo.py:42: AssertionError"   — at the exception's origin
# Match all three by allowing any tail after "file.py:NN:".
_RE_FRAME = re.compile(r"^\S+\.py:\d+:(?:\s+.*)?$")

# Short-summary outcome lines (the block under "short test summary info").
_RE_SUMMARY_OUTCOME = re.compile(
    r"^(FAILED|PASSED|ERROR|SKIPPED|XFAIL|XPASS)\s+",
)

# Final result banner contents — e.g. "1 failed, 46 passed in 329.22s (0:05:29)".
# We pull all "<n> <label>" pairs and the duration.
_RE_COUNT = re.compile(
    r"(\d+)\s+(failed|passed|errors?|skipped|xfailed|xpassed|warnings?)",
)
_RE_DURATION_SECONDS = re.compile(r"in\s+([\d.]+)s")
_RE_DURATION_PRETTY = re.compile(r"\(([\d:]+)\)")

# Progress char → token-kind suffix. Kept as ASCII names so the resulting
# CSS class (`pytest-token--prog-fail`) is selector-safe and themeable.
_PROGRESS_KIND = {
    ".": "pass",
    "F": "fail",
    "E": "error",
    "s": "skip",
    "x": "xfail",
    "X": "xpass",
}


def parse_pytest_output(raw: str) -> dict[str, Any]:
    """Parse pytest console output into a token stream + summary header.

    Returns a dict with two keys:
        tokens: list of {kind, text}. Each non-progress line becomes a
            single token whose text ends in "\\n"; progress lines are
            split into per-character tokens so individual `.`/`F`/`E`
            outcomes can be colored independently.
        summary: dict drawn from the final result banner — `total`,
            `passed`, `failed`, `errors`, `skipped`, `xfailed`,
            `xpassed`, `warnings`, `duration_seconds`, `duration_pretty`.
            Empty when no result banner is present.

    The function never raises on malformed input; unrecognized lines
    fall through as `"text"` tokens.
    """
    if not raw:
        return {"tokens": [], "summary": {}}

    tokens: list[dict[str, str]] = []
    summary: dict[str, Any] = {}

    for line in raw.splitlines():
        kind = _classify(line)

        # The final "=== 1 failed, 46 passed ===" banner is both a banner
        # and the source of the summary chips. Re-tag it as "result" so
        # the frontend can style it distinctly, and harvest the counts.
        if kind == "banner" and _RE_COUNT.search(line):
            kind = "result"
            parsed = _parse_summary(line)
            if parsed:
                summary = parsed

        if kind == "progress":
            for ch in line:
                suffix = _PROGRESS_KIND.get(ch, "other")
                tokens.append({"kind": f"prog-{suffix}", "text": ch})
            tokens.append({"kind": "text", "text": "\n"})
        else:
            tokens.append({"kind": kind, "text": line + "\n"})

    return {"tokens": tokens, "summary": summary}


def _classify(line: str) -> str:
    """Map a single pytest output line to a token-kind name."""
    if not line.strip():
        return "blank"
    if _RE_BANNER_EQ.match(line):
        return "banner"
    if _RE_BANNER_US.match(line):
        return "failure-header"
    if _RE_BANNER_DASH.match(line):
        return "divider"
    if _RE_PROGRESS.match(line):
        return "progress"
    # "E   ..." is the assertion / exception text in a traceback. Pytest
    # uses tab or 3+ spaces after the E; matching with rstrip avoids
    # missing trailing-whitespace cases.
    if line.startswith("E ") or line == "E" or line.startswith("E\t"):
        return "error"
    # ">   ..." marks the line of project code that was running when
    # the assertion blew up — the most important line in any traceback.
    if line.startswith("> ") or line.startswith(">\t"):
        return "code-pointer"
    if _RE_FRAME.match(line):
        # 3rd-party frames (under .venv/ or site-packages/) are noise in
        # 90% of failures — flag them so the frontend can dim them.
        if ".venv/" in line or "site-packages/" in line:
            return "frame-vendor"
        return "frame-project"
    m = _RE_SUMMARY_OUTCOME.match(line)
    if m:
        return f"summary-{m.group(1).lower()}"
    return "text"


def _parse_summary(line: str) -> dict[str, Any]:
    """Extract counts + duration from the final result banner."""
    out: dict[str, Any] = {}
    for count, label in _RE_COUNT.findall(line):
        out[label] = int(count)
    # `total` rolls up every outcome — but not warnings, which aren't
    # test outcomes (a passing run can emit warnings).
    outcome_keys = ("passed", "failed", "errors", "skipped", "xfailed", "xpassed")
    if any(k in out for k in outcome_keys):
        out["total"] = sum(out.get(k, 0) for k in outcome_keys)
    m = _RE_DURATION_SECONDS.search(line)
    if m:
        out["duration_seconds"] = float(m.group(1))
    m = _RE_DURATION_PRETTY.search(line)
    if m:
        out["duration_pretty"] = m.group(1)
    return out
