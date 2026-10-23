import React, { useState } from "react";
import { api, errorText, today } from "./api";
import { Day, Status } from "./types";
export default function Nights({
  days,
  root,
  onSaved,
  onSelect,
}: {
  days: Day[];
  root: string;
  onSaved: () => void;
  onSelect: (day: Day) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(30);
  const visible = [...days].reverse().slice(0, limit);
  async function review(status: Status) {
    setBusy(true);
    setError("");
    try {
      await api(`${root}nights/review/`, "POST", {
        nights: days
          .filter(d => selected.includes(d.date))
          .map(d => ({ date: d.date, revision: d.revision, status })),
      });
      setSelected([]);
      onSaved();
    } catch (err) {
      setError(errorText(err));
      onSaved();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="qs-card">
      <div className="qs-section-head">
        <div>
          <h2>Nightly timeline</h2>
          <p>Night ending on the date shown · New York time · noon to noon</p>
        </div>
      </div>
      <div className="qs-actions">
        <span>{selected.length} selected</span>
        <button disabled={busy || !selected.length} onClick={() => review("complete")}>
          Confirm complete
        </button>
        <button disabled={busy || !selected.length} onClick={() => review("incomplete")}>
          Mark incomplete
        </button>
        <button disabled={busy || !selected.length} onClick={() => review("unreviewed")}>
          Reset review
        </button>
      </div>
      <p className="qs-muted">
        Confirming a night with no events records zero awakenings. Unreviewed and incomplete nights
        are excluded from the nightly average.
      </p>
      {error && (
        <p className="qs-error" role="alert">
          {error}
        </p>
      )}
      <div className="qs-table-wrap">
        <table className="qs-night-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select displayed nights"
                  checked={
                    visible.filter(d => d.date <= today()).length > 0 &&
                    visible.filter(d => d.date <= today()).every(d => selected.includes(d.date))
                  }
                  onChange={e =>
                    setSelected(
                      e.target.checked
                        ? visible.filter(d => d.date <= today()).map(d => d.date)
                        : []
                    )
                  }
                />
              </th>
              <th>Night ending</th>
              <th>
                <div className="qs-timeline-axis">
                  <span>Noon</span>
                  <span>6 pm</span>
                  <span>Midnight</span>
                  <span>6 am</span>
                  <span>Noon</span>
                </div>
              </th>
              <th>Recorded</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(day => (
              <tr key={day.date}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${day.date}`}
                    disabled={busy || day.date > today()}
                    checked={selected.includes(day.date)}
                    onChange={e =>
                      setSelected(
                        e.target.checked
                          ? [...selected, day.date]
                          : selected.filter(d => d !== day.date)
                      )
                    }
                  />
                </td>
                <td>
                  <button className="qs-link" onClick={() => onSelect(day)}>
                    {day.date}
                  </button>
                </td>
                <td>
                  <svg className="qs-timeline">
                    {day.events.map(event => (
                      <circle
                        key={event.uuid}
                        cx={`${(event.hour / 24) * 100}%`}
                        cy="50%"
                        r="5"
                        className="qs-event"
                        role="button"
                        tabIndex={0}
                        aria-label={`Awakening ${event.time}`}
                        onClick={() => onSelect(day)}
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(day);
                          }
                        }}
                      >
                        <title>{`${event.time}${event.note ? ` · ${event.note}` : ""}`}</title>
                      </circle>
                    ))}
                  </svg>
                </td>
                <td>{day.awakenings ?? "—"}</td>
                <td>
                  <span className={`qs-status ${day.status}`}>{day.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limit < days.length && (
        <button onClick={() => setLimit(limit + 30)}>Show 30 more nights</button>
      )}
    </section>
  );
}
