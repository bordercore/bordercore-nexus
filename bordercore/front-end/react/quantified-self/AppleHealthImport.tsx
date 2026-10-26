import React, { useRef, useState } from "react";
import { api, errorText } from "./api";
import { labels } from "./types";
import ImportFilePicker from "./ImportFilePicker";
import ImportProgress, { useImportProgress } from "./ImportProgress";

type HealthKind = "weight" | "blood-pressure" | "resting-heart-rate" | "hrv" | "sleep";
const importLabels = { ...labels, sleep: "Sleep intervals" };
interface Summary {
  kind: HealthKind;
  total: number;
  new: number;
  existing: number;
  first_date: string | null;
  last_date: string | null;
  sources: string[];
}
interface Preview {
  uuid: string;
  committed: boolean;
  result: { imported?: number; skipped?: number };
  summary: Summary[];
  warnings: { repeated_entries: number; incomplete_pressure: number; ambiguous_pressure: number };
  rows: { kind: HealthKind; data: Record<string, string>; status: string }[];
}

export default function AppleHealthImport({
  root,
  onSaved,
  onHistoryChanged,
  onBusy,
}: {
  root: string;
  onSaved: () => void;
  onHistoryChanged: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const progress = useImportProgress(root);

  function working(value: boolean) {
    setBusy(value);
    onBusy(value);
  }
  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setError("");
    setMessage("");
    setPreview(null);
    if (file.size > 512 * 1024 * 1024) {
      setError("Apple Health ZIP files must be no larger than 512 MB.");
      return;
    }
    working(true);
    const progressId = progress.begin("uploading");
    const body = new FormData();
    body.set("file", file);
    body.set("progress_id", progressId);
    try {
      setPreview(
        await api<Preview>(`${root}apple-health/import/`, "POST", body, {
          onUploadProgress: progress.uploaded,
        })
      );
      onHistoryChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      progress.finish();
      working(false);
    }
  }
  async function commit() {
    if (!preview) return;
    working(true);
    setError("");
    const progressId = progress.begin("checking");
    try {
      const result = await api<{ imported: number; skipped: number }>(
        `${root}imports/${preview.uuid}/commit/`,
        "POST",
        { progress_id: progressId }
      );
      setMessage(
        `Imported ${result.imported} readings; skipped ${result.skipped} already imported readings.`
      );
      setPreview(null);
      setFile(null);
      if (input.current) input.current.value = "";
      onHistoryChanged();
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      progress.finish();
      working(false);
    }
  }
  return (
    <div aria-busy={busy}>
      <p>
        Upload the ZIP from Apple Health’s “Export All Health Data”. Preview and import weight,
        blood pressure, resting heart rate, and HRV (SDNN), and sleep intervals together. Sources
        and measurement times are preserved; other health data is ignored.
      </p>
      <form onSubmit={upload}>
        <fieldset disabled={busy}>
          <ImportFilePicker
            label="Apple Health ZIP file"
            inputRef={input}
            file={file}
            accept=".zip,application/zip,application/x-zip,application/x-zip-compressed"
            onChange={selected => {
              setFile(selected);
              setPreview(null);
              setError("");
              setMessage("");
            }}
          />
          <div className="qs-actions">
            <button className="qs-primary" disabled={!file || busy}>
              {busy ? "Working…" : "Preview Apple Health import"}
            </button>
          </div>
        </fieldset>
      </form>
      <p className="qs-muted">
        Up to 512 MB compressed / 100,000 readings. Large exports may take a minute or more to
        process. Repeated and overlapping exports skip existing readings and preserve your
        corrections.
      </p>
      {busy && progress.progress && (
        <ImportProgress
          progress={progress.progress}
          elapsed={progress.elapsed}
          unavailable={progress.unavailable}
        />
      )}
      {error && (
        <p className="qs-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="qs-success" role="status">
          {message}
        </p>
      )}
      {preview && (
        <div className="qs-preview">
          <h3>
            {preview.committed ? "These readings were already imported" : "Review before importing"}
          </h3>
          {preview.committed && (
            <p>
              {preview.result.imported} imported; {preview.result.skipped} skipped in the original
              import.
            </p>
          )}
          <div className="qs-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tracker</th>
                  <th>Found</th>
                  <th>New</th>
                  <th>Already imported</th>
                  <th>Date range</th>
                </tr>
              </thead>
              <tbody>
                {preview.summary.map(item => (
                  <tr key={item.kind}>
                    <td>{importLabels[item.kind]}</td>
                    <td>{item.total}</td>
                    <td>{item.new}</td>
                    <td>{item.existing}</td>
                    <td>
                      {item.first_date ? `${item.first_date} – ${item.last_date}` : "No readings"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.summary
            .filter(item => item.total > 0)
            .map(item => (
              <p key={item.kind} className="qs-muted">
                {importLabels[item.kind]} sources: {item.sources.join(", ")}
              </p>
            ))}
          <p>
            {preview.warnings.repeated_entries} repeated XML entries removed within this export.
          </p>
          {(preview.warnings.incomplete_pressure > 0 ||
            preview.warnings.ambiguous_pressure > 0) && (
            <p role="status">
              Skipped {preview.warnings.incomplete_pressure} incomplete and{" "}
              {preview.warnings.ambiguous_pressure} ambiguous blood-pressure groups. Each reading
              needs one systolic and one diastolic value from the same source and time interval.
            </p>
          )}
          <p>
            Existing readings are skipped automatically. Blood-pressure pulse is not imported in
            this version.
          </p>
          <details>
            <summary>Latest readings (up to 50)</summary>
            <div className="qs-table-wrap qs-preview-table">
              <table>
                <thead>
                  <tr>
                    <th>Tracker</th>
                    <th>Date and time</th>
                    <th>Reading</th>
                    <th>Source</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map(row => (
                    <tr key={row.data.external_id}>
                      <td>{importLabels[row.kind]}</td>
                      <td>
                        {row.data.date} {row.data.time} {row.data.timezone}
                      </td>
                      <td>
                        {row.kind === "sleep"
                          ? `${row.data.stage.replaceAll("_", " ")} · ${row.data.start} → ${row.data.end}`
                          : row.kind !== "blood-pressure"
                            ? `${row.data.value} ${row.data.unit}`
                            : `${row.data.systolic}/${row.data.diastolic} mmHg`}
                      </td>
                      <td>{row.data.source}</td>
                      <td>{row.status === "new" ? "New" : "Already imported"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {!preview.committed && (
            <button
              className="qs-primary"
              disabled={busy || !preview.summary.some(item => item.new > 0)}
              onClick={commit}
            >
              {busy ? "Importing…" : "Confirm Apple Health import"}
            </button>
          )}
          {!preview.committed && !preview.summary.some(item => item.new > 0) && (
            <p>No new readings to import.</p>
          )}
        </div>
      )}
    </div>
  );
}
