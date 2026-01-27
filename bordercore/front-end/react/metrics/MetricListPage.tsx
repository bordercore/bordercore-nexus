import React, { useState, useRef, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { Modal } from "bootstrap";
import Card from "../common/Card";

interface TestResultBase {
  test_overdue: boolean;
  test_runtime: string;
}

interface StandardTestResult extends TestResultBase {
  test_count: string;
  test_errors: string;
  test_failures: string;
  test_time_elapsed: string;
  test_output: string;
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
  className: "text-success",
  icon: faCheck,
};

type StandardTestType = "unit" | "functional" | "data" | "wumpus";

export function MetricListPage({ testResults }: MetricListPageProps) {
  const [selectedTest, setSelectedTest] = useState<StandardTestType>("unit");
  const modalRef = useRef<Modal | null>(null);

  useEffect(() => {
    const modalElement = document.getElementById("modalTestOutput");
    if (modalElement) {
      modalRef.current = new Modal(modalElement);
    }
    return () => {
      modalRef.current?.dispose();
    };
  }, []);

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
    modalRef.current?.show();
  };

  return (
    <div className="h-100" id="metric-list-page">
      <div className="h-100 row g-0 mx-2">
        {/* Left column - Methodology description */}
        <div className="col-lg-3 d-flex flex-column flex-grow-1 pe-gutter">
          <div className="card-body h-100">
            <h3 className="mb-4">Bordercore Testing Methodology</h3>

            <h4 className="text-secondary mt-4">Unit Testing</h4>
            Tests that primarily focus on the Django models and integration tests on the Django views.

            <h4 className="text-secondary mt-4">Functional Testing</h4>
            Selenium-based tests for the front-end.

            <h4 className="text-secondary mt-4">Data Quality Testing</h4>
            Check for inconsistent or missing data in the database.

            <h4 className="text-secondary mt-4">Wumpus Testing</h4>
            Check that the data stored in S3 is consistent with the data stored on wumpus.
          </div>
        </div>

        {/* Second column - Unit Tests and Wumpus Tests */}
        <div className="col-lg-3 d-flex flex-column pe-gutter">
          <Card title="Unit Tests" cardClassName="hoverable flex-grow-0 mb-gutter">
            <hr className="divider" />
            <div className="d-flex" onClick={() => showTestResults("unit")}>
              <div className="flex-grow-1">
                <div className="d-flex">
                  <div className="item-name fw-bold">Test Count</div>
                  <div className="item-value ms-auto">
                    {testResults.unit.test_count}
                  </div>
                </div>
                <div className="d-flex">
                  <div className="item-name fw-bold">Errors</div>
                  <div className="item-value ms-auto">
                    {testResults.unit.test_errors}
                  </div>
                </div>
                <div className="d-flex">
                  <div className="item-name fw-bold">Failures</div>
                  <div className="item-value ms-auto">
                    {testResults.unit.test_failures}
                  </div>
                </div>
                <div className="d-flex">
                  <div className="item-name fw-bold">Runtime</div>
                  <div className="item-value ms-auto">
                    {testResults.unit.test_time_elapsed}
                  </div>
                </div>
              </div>
              <div className="ms-3">
                <FontAwesomeIcon className={`ms-1 fa-3x ${statusUnit.className}`} icon={statusUnit.icon} />
              </div>
            </div>
            <div className="d-flex">
              <div className="item-name fw-bold">Date</div>
              <div className={`item-value ms-auto${testResults.unit.test_overdue ? " text-danger" : ""}`}>
                {testResults.unit.test_runtime}
              </div>
            </div>
          </Card>

          <Card title="Wumpus Tests" cardClassName="hoverable flex-grow-1">
            <hr className="divider" />
            <div className="d-flex" onClick={() => showTestResults("wumpus")}>
              <div className="flex-grow-1">
                <div className="d-flex">
                  <div className="item-name fw-bold">Test Count</div>
                  <div className="ms-auto">
                    {testResults.wumpus.test_count}
                  </div>
                </div>
                <div className="d-flex">
                  <div className="item-name fw-bold">Errors</div>
                  <div className="ms-auto">
                    {testResults.wumpus.test_errors}
                  </div>
                </div>
                <div className="d-flex">
                  <div className="item-name fw-bold">Failures</div>
                  <div className="ms-auto">
                    {testResults.wumpus.test_failures}
                  </div>
                </div>
                <div className="d-flex">
                  <div className="item-name fw-bold">Runtime</div>
                  <div className="item-value ms-auto">
                    {testResults.wumpus.test_time_elapsed}
                  </div>
                </div>
              </div>
              <div className="ms-3">
                <FontAwesomeIcon className={`ms-1 fa-3x ${statusWumpus.className}`} icon={statusWumpus.icon} />
              </div>
            </div>
            <div className="d-flex">
              <div className="item-name fw-bold">Date</div>
              <div className={`item-value ms-auto${testResults.wumpus.test_overdue ? " text-danger" : ""}`}>
                {testResults.wumpus.test_runtime}
              </div>
            </div>
          </Card>
        </div>

        {/* Third column - Functional Tests and Code Coverage */}
        <div className="col-lg-3 d-flex flex-column pe-gutter">
          <Card title="Functional Tests" cardClassName="hoverable flex-grow-0 mb-gutter">
            <hr className="divider" />
            <div className="d-flex" onClick={() => showTestResults("functional")}>
              <div className="flex-grow-1">
                <div className="d-flex">
                  <div className="item-name fw-bold">Test Count</div>
                  <div className="item-value ms-auto">
                    {testResults.functional.test_count}
                  </div>
                </div>
                <div className="d-flex">
                  <div className="item-name fw-bold">Errors</div>
                  <div className="item-value ms-auto">
                    {testResults.functional.test_errors}
                  </div>
                </div>
                <div className="d-flex">
                  <div className="item-name fw-bold">Failures</div>
                  <div className="item-value ms-auto">
                    {testResults.functional.test_failures}
                  </div>
                </div>
                <div className="d-flex">
                  <div className="item-name fw-bold">Runtime</div>
                  <div className="item-value ms-auto">
                    {testResults.functional.test_time_elapsed}
                  </div>
                </div>
              </div>
              <div className="ms-3">
                <FontAwesomeIcon className={`ms-1 fa-3x ${statusFunctional.className}`} icon={statusFunctional.icon} />
              </div>
            </div>
            <div className="d-flex">
              <div className="item-name fw-bold">Date</div>
              <div className={`item-value ms-auto${testResults.functional.test_overdue ? " text-danger" : ""}`}>
                {testResults.functional.test_runtime}
              </div>
            </div>
          </Card>

          <Card title="Code Coverage" cardClassName="flex-grow-1">
            <hr className="divider" />
            <div className="d-flex">
              <div className="flex-grow-1">
                <div className="d-flex">
                  <div className="item-name fw-bold">Coverage</div>
                  <div className="item-value ms-auto">
                    {testResults.coverage.line_rate}%
                  </div>
                </div>
              </div>
              <div className="ms-3">
                <FontAwesomeIcon className={`ms-1 fa-3x ${statusCoverage.className}`} icon={statusCoverage.icon} />
              </div>
            </div>
            <div className="d-flex">
              <div className="item-name fw-bold">Date</div>
              <div className={`item-value ms-auto${testResults.coverage.test_overdue ? " text-danger" : ""}`}>
                {testResults.coverage.test_runtime}
              </div>
            </div>
          </Card>
        </div>

        {/* Fourth column - Data Quality Tests */}
        <div className="col-lg-3 d-flex flex-column">
          <div className="d-flex flex-grow-1">
            <Card title="Data Quality Tests" cardClassName="hoverable">
              <hr className="divider" />
              <div className="d-flex" onClick={() => showTestResults("data")}>
                <div className="flex-grow-1">
                  <div className="d-flex">
                    <div className="item-name fw-bold">Test Count</div>
                    <div className="item-value ms-auto">
                      {testResults.data.test_count}
                    </div>
                  </div>
                  <div className="d-flex">
                    <div className="item-name fw-bold">Errors</div>
                    <div className="item-value ms-auto">
                      {testResults.data.test_errors}
                    </div>
                  </div>
                  <div className="d-flex">
                    <div className="item-name fw-bold">Failures</div>
                    <div className="item-value ms-auto">
                      {testResults.data.test_failures}
                    </div>
                  </div>
                  <div className="d-flex">
                    <div className="item-name fw-bold">Runtime</div>
                    <div className="item-value ms-auto">
                      {testResults.data.test_time_elapsed}
                    </div>
                  </div>
                </div>
                <div className="ms-3">
                  <FontAwesomeIcon className={`ms-1 fa-3x ${statusData.className}`} icon={statusData.icon} />
                </div>
              </div>
              <div className="d-flex">
                <div className="item-name fw-bold">Date</div>
                <div className={`item-value ms-auto${testResults.data.test_overdue ? " text-danger" : ""}`}>
                  {testResults.data.test_runtime}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal for test output - uses trusted backend test output, matching Vue v-html pattern */}
      <div id="modalTestOutput" className="modal fade" tabIndex={-1} role="dialog" aria-labelledby="myModalLabel">
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 id="myModalLabel" className="modal-title">
                Test Output
              </h4>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div
              className="modal-body"
              dangerouslySetInnerHTML={{ __html: testResults[selectedTest].test_output || "" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MetricListPage;
