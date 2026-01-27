import React from "react";
import { createRoot } from "react-dom/client";
import MetricListPage, { TestResults } from "../react/metrics/MetricListPage";

const defaultTestResult = {
  test_count: "0",
  test_errors: "0",
  test_failures: "0",
  test_overdue: false,
  test_time_elapsed: "",
  test_runtime: "",
  test_output: "",
};

const defaultCoverageResult = {
  line_rate: 0,
  test_overdue: false,
  test_runtime: "",
};

const container = document.getElementById("react-root");
if (container) {
  const testResultsJson = container.getAttribute("data-test-results") || "{}";

  let testResults: TestResults = {
    unit: { ...defaultTestResult },
    functional: { ...defaultTestResult },
    data: { ...defaultTestResult },
    wumpus: { ...defaultTestResult },
    coverage: { ...defaultCoverageResult },
  };

  try {
    testResults = JSON.parse(testResultsJson);
  } catch (e) {
    console.error("Error parsing test results:", e);
  }

  const root = createRoot(container);
  root.render(<MetricListPage testResults={testResults} />);
}
