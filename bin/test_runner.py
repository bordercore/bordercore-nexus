"""Test runner utilities for executing pytest suites and recording metrics.

This module orchestrates several test modes (unit, coverage, functional,
wumpus, and data-quality), captures their results in JUnit XML / coverage XML,
and persists summarized metrics to the database.

Environment Variables:
  BORDERCORE_HOME: Absolute path to the Bordercore project root. Required.

Notes:
  - Ensure your virtualenv's bin directory is on PATH so the correct `pytest`
    is invoked.
"""

import argparse
import datetime
import getpass
import os
import pathlib
import shutil
import sys
import xml.etree.ElementTree as ET
from subprocess import PIPE, STDOUT, Popen
from typing import Any, Literal, Optional

import django

from lib.time_utils import convert_seconds

django.setup()

from metrics.models import Metric, MetricData

TEST_REPORT = f"/tmp/test_report-{getpass.getuser()}.xml"
SUBSET_REPORT = f"/tmp/test_report-subset-{getpass.getuser()}.xml"
COVERAGE_REPORT = f"/tmp/coverage-{getpass.getuser()}.xml"
UV_BIN = shutil.which("uv") or "/var/www/.local/bin/uv"

TestKind = Literal["unit", "coverage", "functional", "wumpus", "data"]

# Maps each test kind to the Metric name its results are recorded against.
SUBSET_METRIC_NAME: dict[str, str] = {
    "unit": "Bordercore Unit Tests",
    "coverage": "Bordercore Unit Tests",
    "functional": "Bordercore Functional Tests",
    "wumpus": "Bordercore Wumpus Tests",
    "data": "Bordercore Data Quality Tests",
}


def _nodeid_from_testcase(testcase_el: ET.Element) -> str:
    """Reconstruct a pytest node id from a JUnit XML <testcase> element.

    Pytest's JUnit output sometimes omits the `file` attribute (notably
    for tests selected by -k). In that case we derive the path from
    `classname` so the resulting nodeid matches what a full-suite run
    would record (otherwise `test_failures_detail` merge by string
    equality wouldn't line up across run modes).
    """
    file_attr = testcase_el.get("file", "")
    classname = testcase_el.get("classname", "")
    name = testcase_el.get("name", "")
    if not file_attr and classname:
        file_attr = classname.replace(".", "/") + ".py"
    if not file_attr:
        return f"{classname}::{name}" if classname else name
    module_dotted = file_attr.removesuffix(".py").replace("/", ".")
    if classname and classname != module_dotted and classname.startswith(module_dotted + "."):
        cls_part = classname[len(module_dotted) + 1:]
        return f"{file_attr}::{cls_part}::{name}"
    return f"{file_attr}::{name}"


def _is_real_testcase(testcase_el: ET.Element) -> bool:
    """True if a <testcase> represents a real test, not a collection error.

    Pytest emits a synthetic <testcase classname="" name="."> when
    collection itself errors. Letting these flow into MetricData would
    inflate the topbar failure count with things that aren't tests, so we
    drop them at the boundary. Real tests always carry a classname; the
    `file` attribute is unreliable (pytest sometimes omits it for tests
    selected via -k).
    """
    return bool(testcase_el.get("classname"))


def _failing_details(testsuite_el: ET.Element) -> list[dict[str, str]]:
    """Pull (nodeid, kind) for every failing/erroring <testcase> in a suite."""
    details: list[dict[str, str]] = []
    for tc in testsuite_el.findall("testcase"):
        if not _is_real_testcase(tc):
            continue
        if tc.find("failure") is not None:
            details.append({"nodeid": _nodeid_from_testcase(tc), "kind": "failure"})
        elif tc.find("error") is not None:
            details.append({"nodeid": _nodeid_from_testcase(tc), "kind": "error"})
    return details


def _extract_outcomes(report_path: str) -> dict[str, str]:
    """Return {nodeid: 'failure'|'error'|'skipped'|'passed'} from a JUnit XML."""
    root = ET.parse(report_path).getroot()
    testsuite = root.find("testsuite") if root.tag == "testsuites" else root
    if testsuite is None:
        return {}
    outcomes: dict[str, str] = {}
    for tc in testsuite.findall("testcase"):
        if not _is_real_testcase(tc):
            continue
        nodeid = _nodeid_from_testcase(tc)
        if tc.find("failure") is not None:
            outcomes[nodeid] = "failure"
        elif tc.find("error") is not None:
            outcomes[nodeid] = "error"
        elif tc.find("skipped") is not None:
            outcomes[nodeid] = "skipped"
        else:
            outcomes[nodeid] = "passed"
    return outcomes


def parse_test_report(test_type: str, test_output: Optional[str] = None) -> None:
    """Parse the JUnit XML test report and persist a MetricData row.

    Args:
      test_type: Human-readable test name (e.g., "Bordercore Unit Tests").
      test_output: Raw stdout/stderr captured from the pytest run, if available.

    Raises:
      FileNotFoundError: If the JUnit XML report file does not exist.
      ET.ParseError: If the JUnit XML file is malformed.
      Metric.DoesNotExist: If there is no `Metric` with name `test_type`.
    """
    root = ET.parse(TEST_REPORT).getroot()
    testsuite = root.find("testsuite")
    if testsuite is None:
        raise ET.ParseError("Missing <testsuite> element in JUnit XML report.")

    time_str: str = testsuite.get("time", "0")

    test_results: dict[str, Any] = {
        "test_failures": testsuite.get("failures"),
        "test_errors": testsuite.get("errors"),
        "test_skipped": testsuite.get("skipped"),
        "test_count": testsuite.get("tests"),
        "test_time_elapsed": convert_seconds(int(float(time_str))),
        "test_output": test_output,
        # Per-test node ids for failures/errors. Lets `--only` / `-k` re-runs
        # merge into this row precisely instead of guessing from counts.
        "test_failures_detail": _failing_details(testsuite),
    }

    test_runtime = datetime.datetime.fromtimestamp(pathlib.Path(TEST_REPORT).stat().st_mtime)

    metric = Metric.objects.get(name=test_type)
    data = MetricData(metric=metric, value=test_results, created=test_runtime)
    data.save()


def parse_coverage_report() -> None:
    """Parse the coverage XML report and persist a MetricData row.

    Reads the Cobertura-style XML produced by `pytest-cov` and saves the overall
    line-rate to the "Bordercore Test Coverage" metric.

    Raises:
      FileNotFoundError: If the coverage XML report file does not exist.
      ET.ParseError: If the coverage XML is malformed.
      Metric.DoesNotExist: If there is no `Metric` named "Bordercore Test Coverage".
    """
    root = ET.parse(COVERAGE_REPORT).getroot()

    test_results = {
        "line_rate": root.get("line-rate"),
    }

    timestamp_raw: str = root.get("timestamp", "0")
    test_runtime = datetime.datetime.fromtimestamp(int(timestamp_raw) / 1000)
    metric = Metric.objects.get(name="Bordercore Test Coverage")
    data = MetricData(metric=metric, value=test_results, created=test_runtime)
    data.save()


def run_test(test_kind: TestKind, is_verbose: bool = False) -> int:
    """Run the selected pytest suite, parse results, and return exit code.

    Args:
      test_kind: Which test group to run. One of:
        - "unit": Standard unit tests (excludes data_quality & functional).
        - "coverage": Unit tests with coverage (HTML + XML saved).
        - "functional": Functional tests only.
        - "wumpus": Wumpus tests with Django plugin disabled.
        - "data": Data quality tests (excludes wumpus).
      is_verbose: If True, print a brief "Running test ..." message.

    Returns:
      The pytest process return code (0 indicates success).

    Raises:
      ValueError: If an unknown test kind is supplied (should not occur when
        using argparse choices).
    """
    if test_kind == "unit":

        args: dict[str, Any] = {
            "name": "Bordercore Unit Tests",
            "command": [
                UV_BIN,
                "run",
                "pytest",
                "-n",
                "5",
                "-m",
                "not data_quality and not functional",
                f"--junitxml={TEST_REPORT}",
                "--ignore-glob=**/node_modules/*",
                f"{os.environ.get('BORDERCORE_HOME')}/"
            ]
        }

    elif test_kind == "coverage":

        args = {
            "name": "Bordercore Coverage Report",
            "command": [
                UV_BIN,
                "run",
                "pytest",
                "-n",
                "5",
                "-m",
                "not data_quality and not functional",
                "-v",
                f"{os.environ.get('BORDERCORE_HOME')}/",
                f"--cov={os.environ.get('BORDERCORE_HOME')}",
                "--cov-report=html",
                f"--cov-report=xml:{COVERAGE_REPORT}",
                f"--cov-config={os.environ.get('BORDERCORE_HOME')}/../pyproject.toml"
            ]
        }

    elif test_kind == "functional":

        args = {
            "name": "Bordercore Functional Tests",
            "command": [
                UV_BIN,
                "run",
                "pytest",
                "-m",
                "functional",
                f"--junitxml={TEST_REPORT}",
                "--ignore-glob=**/node_modules/*",
                f"{os.environ.get('BORDERCORE_HOME')}/"
            ]
        }

    elif test_kind == "wumpus":

        args = {
            "name": "Bordercore Wumpus Tests",
            "command": [
                UV_BIN,
                "run",
                "pytest",
                "-m",
                "wumpus",
                "-p",
                "no:django",
                "-o",
                "addopts=",
                f"--junitxml={TEST_REPORT}",
                "--ignore-glob=**/node_modules/*",
                f"{os.environ.get('BORDERCORE_HOME')}/",
            ]
        }

    elif test_kind == "data":

        args = {
            "name": "Bordercore Data Quality Tests",
            "command": [
                UV_BIN,
                "run",
                "pytest",
                "-n",
                "3",
                "-m",
                "not wumpus and data_quality",
                "-p", "no:django",
                "-o", "addopts=",
                f"--junitxml={TEST_REPORT}",
                f"{os.environ.get('BORDERCORE_HOME')}/"
            ]
        }

    else:
        raise ValueError(f"Unknown test type: {test_kind}")

    if is_verbose:
        print(f"Running test {args['name']}")

    with Popen(args["command"], stderr=STDOUT, stdout=PIPE) as proc:
        stdout_bytes, _ = proc.communicate()
        rc = int(proc.returncode or 0)

    test_output_text: str = stdout_bytes.decode("utf-8", errors="replace")

    parse_test_report(args["name"], test_output_text)

    if test_kind == "coverage":
        parse_coverage_report()

    return rc


def _subset_command(test_kind: TestKind) -> list[str]:
    """Base pytest command for a subset run of `test_kind`.

    Mirrors the plugin/option flags `run_test` uses for the same kind so a
    targeted re-run still honours that suite's pytest configuration (e.g.
    wumpus must disable the django plugin and clear addopts).

    Marker filters (-m) and the project root path are intentionally omitted —
    the caller appends explicit node ids and/or a -k expression instead.

    The subprocess runs with cwd=$BORDERCORE_HOME (see `run_subset`), so
    bordercore/conftest.py is the top-level conftest from pytest's
    perspective and its `pytest_plugins =` is accepted.
    """
    if test_kind in ("unit", "coverage", "functional"):
        return [
            UV_BIN, "run", "pytest",
            f"--junitxml={SUBSET_REPORT}",
            "--ignore-glob=**/node_modules/*",
        ]
    if test_kind == "wumpus":
        return [
            UV_BIN, "run", "pytest",
            "-p", "no:django",
            "-o", "addopts=",
            f"--junitxml={SUBSET_REPORT}",
            "--ignore-glob=**/node_modules/*",
        ]
    if test_kind == "data":
        return [
            UV_BIN, "run", "pytest",
            "-p", "no:django",
            "-o", "addopts=",
            f"--junitxml={SUBSET_REPORT}",
        ]
    raise ValueError(f"Unknown test type: {test_kind}")


def _normalize_nodeid(nodeid: str) -> str:
    """Strip a leading 'bordercore/' so pasted pytest output works.

    Pytest reports failing nodeids relative to rootdir (the repo root),
    e.g. `bordercore/blob/tests/test_views.py::test_foo`. We run pytest
    with cwd=$BORDERCORE_HOME, so the path arg must be relative to that
    dir. Trim the prefix if present; leave the nodeid untouched otherwise.
    """
    prefix = "bordercore/"
    return nodeid[len(prefix):] if nodeid.startswith(prefix) else nodeid


def merge_subset_result(metric_name: str, subset_output: str) -> None:
    """Merge a subset run's outcomes into the latest MetricData for `metric_name`.

    Decrements the prior failure/error counts for each subset test that now
    passes, removes them from `test_failures_detail`, and appends the subset
    run's raw output to `test_output` under a dated separator. Saves a new
    MetricData row — the post_save signal then repaints the topbar pill.

    Falls back gracefully when the prior row has no `test_failures_detail`
    (rows written before this field was added): each subset test that now
    passes decrements the failure count by one, clamped at zero.
    """
    outcomes = _extract_outcomes(SUBSET_REPORT)
    if not outcomes:
        print("Subset run produced no testcase results; nothing to merge.")
        return

    metric = Metric.objects.get(name=metric_name)
    prior = MetricData.objects.filter(metric=metric).order_by("-created").first()

    if prior is None:
        # No baseline to merge against — promote the subset report to the
        # full-suite slot and parse it as a normal run.
        shutil.copy(SUBSET_REPORT, TEST_REPORT)
        parse_test_report(metric_name, subset_output)
        return

    prior_value: dict[str, Any] = dict(prior.value or {})
    prior_details: list[dict[str, str]] = list(prior_value.get("test_failures_detail") or [])
    prior_kind: dict[str, str] = {d["nodeid"]: d["kind"] for d in prior_details}
    has_details = bool(prior_details)

    new_details = list(prior_details)
    new_failures = int(prior_value.get("test_failures") or 0)
    new_errors = int(prior_value.get("test_errors") or 0)

    for nodeid, outcome in outcomes.items():
        was_known = nodeid in prior_kind
        if outcome == "passed":
            if was_known:
                kind = prior_kind[nodeid]
                if kind == "error":
                    new_errors = max(0, new_errors - 1)
                else:
                    new_failures = max(0, new_failures - 1)
                new_details = [d for d in new_details if d["nodeid"] != nodeid]
            elif not has_details:
                new_failures = max(0, new_failures - 1)
        elif outcome in ("failure", "error"):
            if was_known:
                if prior_kind[nodeid] != outcome:
                    new_details = [d for d in new_details if d["nodeid"] != nodeid]
                    new_details.append({"nodeid": nodeid, "kind": outcome})
                    if outcome == "failure":
                        new_failures += 1
                        new_errors = max(0, new_errors - 1)
                    else:
                        new_errors += 1
                        new_failures = max(0, new_failures - 1)
            else:
                new_details.append({"nodeid": nodeid, "kind": outcome})
                if outcome == "failure":
                    new_failures += 1
                else:
                    new_errors += 1

    sep = f"\n\n=== Subset re-run at {datetime.datetime.now():%Y-%m-%d %H:%M:%S} ===\n"
    merged_output = (prior_value.get("test_output") or "") + sep + subset_output

    new_value = dict(prior_value)
    new_value["test_failures"] = str(new_failures)
    new_value["test_errors"] = str(new_errors)
    new_value["test_output"] = merged_output
    new_value["test_failures_detail"] = new_details

    MetricData.objects.create(metric=metric, value=new_value)


def run_subset(
    test_kind: TestKind,
    nodeids: list[str],
    keyword: Optional[str],
    is_verbose: bool = False,
) -> int:
    """Run a targeted subset of tests and merge results into the topbar metric."""
    metric_name = SUBSET_METRIC_NAME[test_kind]
    cmd = _subset_command(test_kind)
    if keyword:
        cmd.extend(["-k", keyword])
    normalized_nodeids = [_normalize_nodeid(n) for n in nodeids]
    cmd.extend(normalized_nodeids)

    if is_verbose:
        bits = list(normalized_nodeids)
        if keyword:
            bits.append(f"-k {keyword}")
        print(f"Running subset of {metric_name}: {' '.join(bits)}")

    with Popen(
        cmd,
        stderr=STDOUT,
        stdout=PIPE,
        cwd=os.environ["BORDERCORE_HOME"],
    ) as proc:
        stdout_bytes, _ = proc.communicate()
        rc = int(proc.returncode or 0)

    subset_output = stdout_bytes.decode("utf-8", errors="replace")
    merge_subset_result(metric_name, subset_output)
    return rc


def main() -> None:
    """Command-line entrypoint for running Bordercore tests.

    Parses arguments, validates environment variables, runs the selected test
    suite, and exits with the pytest return code.

    Raises:
      TypeError: If required environment variables are not set.
    """
    for env_var in ("BORDERCORE_HOME",):
        if env_var not in os.environ:
            raise TypeError(f"{env_var} not found in the environment")

    arg_parser = argparse.ArgumentParser(
        description="Run Bordercore tests and persist metrics."
    )
    arg_parser.add_argument(
        "-t",
        "--test",
        help="The test to run.",
        required=True,
        choices=["unit", "coverage", "functional", "wumpus", "data"],
    )
    arg_parser.add_argument(
        "-v",
        "--verbose",
        help="Increase verbosity.",
        action="store_true",
    )
    arg_parser.add_argument(
        "--only",
        help=(
            "Run a single test by pytest node id "
            "(e.g. bordercore/blob/tests/test_views.py::test_blob_detail). "
            "Repeat the flag to run multiple. Results merge into the topbar "
            "metric instead of overwriting it."
        ),
        action="append",
        default=[],
    )
    arg_parser.add_argument(
        "-k",
        "--keyword",
        help="Pytest -k expression: run tests whose name matches the expression.",
        default=None,
    )
    args = arg_parser.parse_args()

    test_kind = args.test
    verbose = args.verbose
    if args.only or args.keyword:
        return_code = run_subset(test_kind, args.only, args.keyword, verbose)
    else:
        return_code = run_test(test_kind, verbose)

    # Close the psycopg connection pool to prevent thread-shutdown
    # warnings at interpreter exit (psycopg_pool worker/scheduler threads).
    from django.db import connections as db_connections
    for conn in db_connections.all():
        if hasattr(conn, 'pool') and conn.pool is not None:
            conn.pool.close()

    sys.exit(return_code)


if __name__ == "__main__":
    main()
