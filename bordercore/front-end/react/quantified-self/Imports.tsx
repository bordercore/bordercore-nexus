import React, { useEffect, useRef, useState } from "react";
import { api, errorText } from "./api";
import { Kind, labels } from "./types";
import AppleHealthImport from "./AppleHealthImport";
import ImportFilePicker from "./ImportFilePicker";
interface Preview {
  uuid: string;
  committed: boolean;
  result: { imported?: number; skipped?: number };
  rows: { line: number; data: Record<string, string>; status: string; error: string }[];
}
interface Batch {
  uuid: string;
  kind: Kind | "apple-health" | "sleep";
  source: string;
  created_at: string;
  committed: boolean;
  result: { imported?: number; skipped?: number };
}
export default function Imports({ root, onSaved }: { root: string; onSaved: () => void }) {
  const [format, setFormat] = useState("apple-health");
  const [kind, setKind] = useState<Kind>("weight");
  const [source, setSource] = useState("CSV");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Batch[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  function loadHistory() {
    api<Batch[]>(`${root}imports/`)
      .then(setHistory)
      .catch(e => setError(errorText(e)));
  }
  useEffect(loadHistory, [root]);
  function reset() {
    setPreview(null);
    setSelected([]);
    setMessage("");
    setError("");
  }
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    reset();
    const data = new FormData();
    data.set("file", file);
    data.set("source", source);
    try {
      setPreview(await api<Preview>(`${root}${kind}/import/`, "POST", data));
      loadHistory();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ imported: number; skipped: number }>(
        `${root}imports/${preview.uuid}/commit/`,
        "POST",
        { include_duplicates: selected }
      );
      setMessage(`Imported ${result.imported} readings; skipped ${result.skipped}.`);
      setPreview(null);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      loadHistory();
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="qs-card">
      <h2>Import readings</h2>
      <label>
        Import format
        <select
          value={format}
          disabled={busy}
          onChange={e => {
            setFormat(e.target.value);
            reset();
          }}
        >
          <option value="csv">CSV</option>
          <option value="apple-health">Apple Health ZIP</option>
        </select>
      </label>
      {format === "apple-health" ? (
        <AppleHealthImport
          root={root}
          onSaved={onSaved}
          onHistoryChanged={loadHistory}
          onBusy={setBusy}
        />
      ) : (
        <>
          <p>
            Use the template for each tracker. Dates are YYYY-MM-DD; awakening timestamps must
            include a UTC offset. Leave unknown measurement times blank.
          </p>
          <form onSubmit={upload}>
            <fieldset disabled={busy}>
              <div className="qs-form-grid qs-import-fields">
                <label>
                  Tracker
                  <select
                    value={kind}
                    onChange={e => {
                      setKind(e.target.value as Kind);
                      reset();
                    }}
                  >
                    {Object.entries(labels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Source name
                  <input
                    required
                    maxLength={100}
                    value={source}
                    onChange={e => {
                      setSource(e.target.value);
                      reset();
                    }}
                    placeholder="e.g. Scale export"
                  />
                </label>
                <ImportFilePicker
                  label="CSV file"
                  inputRef={fileInput}
                  file={file}
                  accept=".csv,text/csv"
                  onChange={selected => {
                    setFile(selected);
                    reset();
                  }}
                />
              </div>
              <div className="qs-actions">
                <a href={`${root}${kind}/export/?template=1`}>Download CSV template</a>
                <button className="qs-primary" disabled={!file || busy}>
                  {busy ? "Working…" : "Preview import"}
                </button>
              </div>
            </fieldset>
          </form>
          <p className="qs-muted">
            Up to 5,000 rows / 2 MB. Reuse the same source name for subsequent exports from the same
            device. Existing external IDs are skipped without overwriting corrections.
          </p>
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
                {preview.committed ? "This file was already imported" : "Review before importing"}
              </h3>
              {preview.committed ? (
                <p>
                  {preview.result.imported} imported; {preview.result.skipped} skipped.
                </p>
              ) : (
                <>
                  <p>
                    {preview.rows.filter(r => r.status === "new").length} new ·{" "}
                    {preview.rows.filter(r => r.status === "possible_duplicate").length} possible
                    duplicates · {preview.rows.filter(r => r.status === "existing_id").length}{" "}
                    existing IDs · {preview.rows.filter(r => r.status === "error").length} errors
                  </p>
                  <p>
                    Possible duplicates are skipped unless you select them below. Correct errors in
                    the file and preview it again.
                  </p>
                </>
              )}
              <div className="qs-table-wrap qs-preview-table">
                <table>
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>Values</th>
                      <th>Status</th>
                      <th>Import anyway</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(row => (
                      <tr key={row.line}>
                        <td>{row.line}</td>
                        <td>
                          {Object.entries(row.data)
                            .filter(([, value]) => value)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(" · ")}
                        </td>
                        <td>{row.error || row.status.replaceAll("_", " ")}</td>
                        <td>
                          {row.status === "possible_duplicate" && !preview.committed && (
                            <input
                              type="checkbox"
                              disabled={busy}
                              aria-label={`Import duplicate line ${row.line}`}
                              checked={selected.includes(row.line)}
                              onChange={e =>
                                setSelected(
                                  e.target.checked
                                    ? [...selected, row.line]
                                    : selected.filter(n => n !== row.line)
                                )
                              }
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!preview.committed && (
                <button
                  className="qs-primary"
                  disabled={busy || preview.rows.some(r => r.status === "error")}
                  onClick={commit}
                >
                  {busy ? "Importing…" : "Confirm import"}
                </button>
              )}
            </div>
          )}
        </>
      )}
      <h3>Recent imports</h3>
      <div className="qs-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Created</th>
              <th>Tracker</th>
              <th>Source</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {history.map(b => (
              <tr key={b.uuid}>
                <td>{new Date(b.created_at).toLocaleString()}</td>
                <td>
                  {b.kind === "apple-health"
                    ? "Apple Health"
                    : b.kind === "sleep"
                      ? "Sleep"
                      : labels[b.kind]}
                </td>
                <td>{b.source}</td>
                <td>
                  {b.committed
                    ? `${b.result.imported} imported; ${b.result.skipped} skipped`
                    : "Preview only"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
