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
import sys
import xml.etree.ElementTree as ET
from subprocess import PIPE, STDOUT, Popen
from typing import Any, Literal, Optional

import django

from lib.time_utils import convert_seconds

django.setup()

from metrics.models import Metric, MetricData

TEST_REPORT = f"/tmp/test_report-{getpass.getuser()}.xml"
COVERAGE_REPORT = f"/tmp/coverage-{getpass.getuser()}.xml"

TestKind = Literal["unit", "coverage", "functional", "wumpus", "data"]


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
        "test_output": test_output
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
                "pytest",
                "-m",
                "wumpus",
                "-p",
                "no:django",
                f"--junitxml={TEST_REPORT}",
                "--ignore-glob=**/node_modules/*",
                f"{os.environ.get('BORDERCORE_HOME')}/",
            ]
        }

    elif test_kind == "data":

        args = {
            "name": "Bordercore Data Quality Tests",
            "command": [
                "pytest",
                "-n",
                "3",
                "-m",
                "not wumpus and data_quality",
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
    args = arg_parser.parse_args()

    test_kind = args.test
    verbose = args.verbose
    return_code = run_test(test_kind, verbose)
    sys.exit(return_code)


if __name__ == "__main__":
    main()
