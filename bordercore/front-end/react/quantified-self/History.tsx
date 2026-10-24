import React, { useEffect, useState } from "react";
import { api, errorText } from "./api";
import { Kind, Reading } from "./types";
export default function History({
  root,
  kind,
  query,
  revision,
  onEdit,
}: {
  root: string;
  kind: Exclude<Kind, "blood-pressure">;
  query: string;
  revision: number;
  onEdit: (row: Reading) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ count: number; results: Reading[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setOffset(0);
  }, [kind, query]);
  useEffect(() => {
    // Keep the current rows on screen while a new range or page loads, so the
    // table doesn't collapse and shift the layout on every change.
    let active = true;
    setError("");
    api<{ count: number; results: Reading[] }>(`${root}${kind}/records/?${query}&offset=${offset}`)
      .then(value => {
        if (active) setData(value);
      })
      .catch(err => {
        if (active) {
          setError(errorText(err));
          setData(null);
        }
      });
    return () => {
      active = false;
    };
  }, [root, kind, query, revision, offset]);
  return (
    <section className="qs-card">
      <div className="qs-section-head">
        <h2>Reading history</h2>
        <a href={`${root}${kind}/export/?${query}`}>Export CSV</a>
      </div>
      {error && (
        <p className="qs-error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading readings…</p>}
      {data && (
        <>
          <div className="qs-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date / time</th>
                  <th>Reading</th>
                  <th>Source</th>
                  <th>Note</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.results.map(row => (
                  <tr key={row.uuid} className={row.excluded ? "qs-excluded" : ""}>
                    <td>
                      {kind === "awakenings" ? (
                        row.timestamp?.replace("T", " ")
                      ) : (
                        <>
                          {row.date}
                          <small>
                            {row.time ? `${row.time} · ${row.timezone}` : "Time unknown"}
                          </small>
                        </>
                      )}
                    </td>
                    <td>{kind === "weight" ? `${row.value} ${row.unit}` : "Awakening"}</td>
                    <td>{row.source}</td>
                    <td className="qs-note-cell">{row.note || "—"}</td>
                    <td>{row.excluded ? "Excluded" : "Included"}</td>
                    <td>
                      <button onClick={() => onEdit(row)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.count && <p className="qs-empty">No readings in this range.</p>}
          <div className="qs-actions">
            <button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>
              Previous
            </button>
            <span>
              {data.count
                ? `${offset + 1}–${Math.min(offset + 50, data.count)} of ${data.count}`
                : "0 readings"}
            </span>
            <button disabled={offset + 50 >= data.count} onClick={() => setOffset(offset + 50)}>
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
