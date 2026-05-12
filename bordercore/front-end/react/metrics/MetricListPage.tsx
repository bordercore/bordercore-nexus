import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faExclamationTriangle, faTimes } from "@fortawesome/free-solid-svg-icons";
import Card from "../common/Card";

interface TestResultBase {
  test_overdue: boolean;
  test_runtime: string;
}

interface PytestToken {
  kind: string;
  text: string;
}

interface PytestSummary {
  total?: number;
  passed?: number;
  failed?: number;
  errors?: number;
  skipped?: number;
  xfailed?: number;
  xpassed?: number;
  warnings?: number;
  duration_seconds?: number;
  duration_pretty?: string;
}

interface StandardTestResult extends TestResultBase {
  test_count: string;
  test_errors: string;
  test_failures: string;
  test_time_elapsed: string;
  test_output_tokens: PytestToken[];
  test_output_summary: PytestSummary;
}

interface CoverageResult extends TestResultBase {
  line_rate: number;
}

export interface TestResults {
  unit: StandardTestResult;
  functional: StandardTestResult;
  data: StandardTestResult;
  wumpus: StandardTestResult;
  coverage: CoverageResult;
}

interface StatusInfo {
  className: string;
  icon: typeof faCheck;
}

interface MetricListPageProps {
  testResults: TestResults;
}

const COVERAGE_MINIMUM = 80;

const failure: StatusInfo = {
  className: "text-danger",
  icon: faExclamationTriangle,
};

const success: StatusInfo = {
  className: "text-ok",
  icon: faCheck,
};

type StandardTestType = "unit" | "functional" | "data" | "wumpus";

export function MetricListPage({ testResults }: MetricListPageProps) {
  const [selectedTest, setSelectedTest] = useState<StandardTestType>("unit");
  const [modalOpen, setModalOpen] = useState(false);

  const closeModal = () => setModalOpen(false);

  useEffect(() => {
    if (!modalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalOpen]);

  const getStatus = (testType: StandardTestType): StatusInfo => {
    const result = testResults[testType];
    if (result.test_overdue) {
      return failure;
    }
    if (result.test_errors === "0" && result.test_failures === "0") {
      return success;
    }
    return failure;
  };

  const statusUnit = useMemo(() => getStatus("unit"), [testResults]);
  const statusFunctional = useMemo(() => getStatus("functional"), [testResults]);
  const statusData = useMemo(() => getStatus("data"), [testResults]);
  const statusWumpus = useMemo(() => getStatus("wumpus"), [testResults]);

  const statusCoverage = useMemo(() => {
    if (testResults.coverage.line_rate >= COVERAGE_MINIMUM && !testResults.coverage.test_overdue) {
      return success;
    }
    return failure;
  }, [testResults]);

  const showTestResults = (testType: StandardTestType) => {
    setSelectedTest(testType);
    setModalOpen(true);
  };

  return (
    <div className="h-full" id="metric-list-page">
      <div className="h-full row g-0 mx-2">
        {/* Left column - Methodology description */}
        <div className="col flex flex-col pe-gutter">
          <div className="card-body h-full">
            <h3 className="mb-6">Bordercore Testing Methodology</h3>
            <h4 className="text-ink-2 mt-6">Unit Testing</h4>
            Tests that primarily focus on the Django models and integration tests on the Django
            views.
            <h4 className="text-ink-2 mt-6">Functional Testing</h4>
            Selenium-based tests for the front-end.
            <h4 className="text-ink-2 mt-6">Data Quality Testing</h4>
            Check for inconsistent or missing data in the database.
            <h4 className="text-ink-2 mt-6">Wumpus Testing</h4>
            Check that the data stored in S3 is consistent with the data stored on wumpus.
          </div>
        </div>

        {/* Second column - Unit Tests and Wumpus Tests */}
        <div className="col flex flex-col pe-gutter">
          <Card title="Unit Tests" cardClassName="dashboard-card grow-0 mb-gutter">
            <hr className="divider" />
            <div className="flex" onClick={() => showTestResults("unit")}>
              <div className="grow">
                <div className="flex">
                  <div className="item-name font-bold">Test Count</div>
                  <div className="item-value ms-auto">{testResults.unit.test_count}</div>
                </div>
                <div className="flex">
                  <div className="item-name font-bold">Errors</div>
                  <div className="item-value ms-auto">{testResults.unit.test_errors}</div>
                </div>
                <div className="flex">
                  <div className="item-name font-bold">Failures</div>
                  <div className="item-value ms-auto">{testResults.unit.test_failures}</div>
                </div>
                <div className="flex">
                  <div className="item-name font-bold">Runtime</div>
                  <div className="item-value ms-auto">{testResults.unit.test_time_elapsed}</div>
                </div>
              </div>
              <div className="ms-4">
                <FontAwesomeIcon
                  className={`ms-1 fa-3x ${statusUnit.className}`}
                  icon={statusUnit.icon}
                />
              </div>
            </div>
            <div className={`item-value${testResults.unit.test_overdue ? " text-danger" : ""}`}>
              {testResults.unit.test_runtime}
            </div>
          </Card>

          <Card title="Wumpus Tests" cardClassName="dashboard-card grow">
            <hr className="divider" />
            <div className="flex" onClick={() => showTestResults("wumpus")}>
              <div className="grow">
                <div className="flex">
                  <div className="item-name font-bold">Test Count</div>
                  <div className="item-value ms-auto">{testResults.wumpus.test_count}</div>
                </div>
                <div className="flex">
                  <div className="item-name font-bold">Errors</div>
                  <div className="item-value ms-auto">{testResults.wumpus.test_errors}</div>
                </div>
                <div className="flex">
                  <div className="item-name font-bold">Failures</div>
                  <div className="item-value ms-auto">{testResults.wumpus.test_failures}</div>
                </div>
                <div className="flex">
                  <div className="item-name font-bold">Runtime</div>
                  <div className="item-value ms-auto">{testResults.wumpus.test_time_elapsed}</div>
                </div>
              </div>
              <div className="ms-4">
                <FontAwesomeIcon
                  className={`ms-1 fa-3x ${statusWumpus.className}`}
                  icon={statusWumpus.icon}
                />
              </div>
            </div>
            <div className={`item-value${testResults.wumpus.test_overdue ? " text-danger" : ""}`}>
              {testResults.wumpus.test_runtime}
            </div>
          </Card>
        </div>

        {/* Third column - Functional Tests and Code Coverage */}
        <div className="col flex flex-col pe-gutter">
          <Card title="Functional Tests" cardClassName="dashboard-card grow-0 mb-gutter">
            <hr className="divider" />
            <div className="flex" onClick={() => showTestResults("functional")}>
              <div className="grow">
                <div className="flex">
                  <div className="item-name font-bold">Test Count</div>
                  <div className="item-value ms-auto">{testResults.functional.test_count}</div>
                </div>
                <div className="flex">
                  <div className="item-name font-bold">Errors</div>
                  <div className="item-value ms-auto">{testResults.functional.test_errors}</div>
                </div>
                <div className="flex">
                  <div className="item-name font-bold">Failures</div>
                  <div className="item-value ms-auto">{testResults.functional.test_failures}</div>
                </div>
                <div className="flex">
                  <div className="item-name font-bold">Runtime</div>
                  <div className="item-value ms-auto">
                    {testResults.functional.test_time_elapsed}
                  </div>
                </div>
              </div>
              <div className="ms-4">
                <FontAwesomeIcon
                  className={`ms-1 fa-3x ${statusFunctional.className}`}
                  icon={statusFunctional.icon}
                />
              </div>
            </div>
            <div
              className={`item-value${testResults.functional.test_overdue ? " text-danger" : ""}`}
            >
              {testResults.functional.test_runtime}
            </div>
          </Card>

          <Card title="Code Coverage" cardClassName="dashboard-card grow">
            <hr className="divider" />
            <div className="flex">
              <div className="grow">
                <div className="flex">
                  <div className="item-name font-bold">Coverage</div>
                  <div className="item-value ms-auto">{testResults.coverage.line_rate}%</div>
                </div>
              </div>
              <div className="ms-4">
                <FontAwesomeIcon
                  className={`ms-1 fa-3x ${statusCoverage.className}`}
                  icon={statusCoverage.icon}
                />
              </div>
            </div>
            <div className={`item-value${testResults.coverage.test_overdue ? " text-danger" : ""}`}>
              {testResults.coverage.test_runtime}
            </div>
          </Card>
        </div>

        {/* Fourth column - Data Quality Tests */}
        <div className="col flex flex-col pe-gutter">
          <div className="flex grow">
            <Card title="Data Quality Tests" cardClassName="dashboard-card w-full">
              <hr className="divider" />
              <div className="flex" onClick={() => showTestResults("data")}>
                <div className="grow">
                  <div className="flex">
                    <div className="item-name font-bold">Test Count</div>
                    <div className="item-value ms-auto">{testResults.data.test_count}</div>
                  </div>
                  <div className="flex">
                    <div className="item-name font-bold">Errors</div>
                    <div className="item-value ms-auto">{testResults.data.test_errors}</div>
                  </div>
                  <div className="flex">
                    <div className="item-name font-bold">Failures</div>
                    <div className="item-value ms-auto">{testResults.data.test_failures}</div>
                  </div>
                  <div className="flex">
                    <div className="item-name font-bold">Runtime</div>
                    <div className="item-value ms-auto">{testResults.data.test_time_elapsed}</div>
                  </div>
                </div>
                <div className="ms-4">
                  <FontAwesomeIcon
                    className={`ms-1 fa-3x ${statusData.className}`}
                    icon={statusData.icon}
                  />
                </div>
              </div>
              <div className={`item-value${testResults.data.test_overdue ? " text-danger" : ""}`}>
                {testResults.data.test_runtime}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal for test output - uses trusted backend test output */}
      {modalOpen &&
        createPortal(
          <>
            <div className="refined-modal-scrim" onClick={closeModal} />
            <div
              className="refined-modal refined-modal--wide"
              role="dialog"
              aria-label="test output"
            >
              <button
                type="button"
                className="refined-modal-close"
                onClick={closeModal}
                aria-label="close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>

              <h2 className="refined-modal-title">Test output</h2>

              <PytestOutput
                tokens={testResults[selectedTest].test_output_tokens}
                summary={testResults[selectedTest].test_output_summary}
              />
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

/**
 * Render a pre-parsed pytest log. Tokens come from the backend
 * (metrics.services.parse_pytest_output) — every token's `kind` maps to a
 * `pytest-token--<kind>` modifier class so coloring is theme-driven via SCSS.
 * The chip header surfaces the run's headline counts; it's hidden when the
 * backend couldn't find a result banner (e.g. an aborted run).
 */
function PytestOutput({ tokens, summary }: { tokens: PytestToken[]; summary: PytestSummary }) {
  return (
    <div className="pytest-output">
      <PytestSummaryChips summary={summary} />
      <pre className="pytest-log">
        {tokens.map((t, i) => (
          <span key={i} className={`pytest-token pytest-token--${t.kind}`}>
            {t.text}
          </span>
        ))}
      </pre>
    </div>
  );
}

function PytestSummaryChips({ summary }: { summary: PytestSummary }) {
  const hasAny =
    summary.total !== undefined ||
    summary.failed ||
    summary.errors ||
    summary.passed ||
    summary.skipped ||
    summary.duration_pretty;
  if (!hasAny) return null;

  return (
    <div className="pytest-summary">
      {summary.total !== undefined && (
        <span className="pytest-chip pytest-chip--total">{summary.total} tests</span>
      )}
      {summary.failed ? (
        <span className="pytest-chip pytest-chip--failed">{summary.failed} failed</span>
      ) : null}
      {summary.errors ? (
        <span className="pytest-chip pytest-chip--errors">{summary.errors} errors</span>
      ) : null}
      {summary.passed ? (
        <span className="pytest-chip pytest-chip--passed">{summary.passed} passed</span>
      ) : null}
      {summary.skipped ? (
        <span className="pytest-chip pytest-chip--skipped">{summary.skipped} skipped</span>
      ) : null}
      {summary.duration_pretty && (
        <span className="pytest-chip pytest-chip--duration">{summary.duration_pretty}</span>
      )}
    </div>
  );
}

export default MetricListPage;
