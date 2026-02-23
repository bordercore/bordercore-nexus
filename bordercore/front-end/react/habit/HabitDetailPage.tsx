import React, { useMemo, useState } from "react";
import MarkdownIt from "markdown-it";
import { doPost } from "../utils/reactUtils";

interface HabitLog {
  uuid: string;
  date: string;
  completed: boolean;
  value: string | null;
  note: string;
}

interface HabitDetail {
  uuid: string;
  name: string;
  purpose: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  tags: string[];
  logs: HabitLog[];
}

interface HabitDetailPageProps {
  habit: HabitDetail;
  logUrl: string;
  listUrl: string;
}

export default function HabitDetailPage({ habit, logUrl, listUrl }: HabitDetailPageProps) {
  const markdown = useMemo(() => new MarkdownIt(), []);
  const [logs, setLogs] = useState<HabitLog[]>(habit.logs);
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [completed, setCompleted] = useState(true);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const params: Record<string, string> = {
      habit_uuid: habit.uuid,
      date: logDate,
      completed: completed ? "true" : "false",
    };
    if (value) params.value = value;
    if (note) params.note = note;

    doPost(
      logUrl,
      params,
      response => {
        const newLog: HabitLog = response.data.log;
        setLogs(prev => {
          const filtered = prev.filter(l => l.date !== newLog.date);
          return [newLog, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
        });
        setValue("");
        setNote("");
      },
      "Log saved"
    );
  }

  return (
    <div className="habit-detail-page">
      <div className="mb-3">
        <a href={listUrl}>&larr; All Habits</a>
      </div>

      <div className="mb-4">
        {/* User-owned content rendered with markdown-it - safe to render */}
        {habit.purpose && (
          <div
            className="text-muted"
            dangerouslySetInnerHTML={{ __html: markdown.render(habit.purpose) }}
          />
        )}
        <div className="d-flex gap-3 text-muted small">
          <span>
            <span className="text-info">Started:</span> {habit.start_date}
          </span>
          {habit.end_date && (
            <span>
              <span className="text-info">Ended:</span> {habit.end_date}
            </span>
          )}
          {habit.tags.length > 0 && (
            <span>
              Tags:{" "}
              {habit.tags.map(tag => (
                <span key={tag} className="badge bg-secondary me-1">
                  {tag}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>

      {habit.is_active && (
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">Log Entry</h5>
            <form onSubmit={handleSubmit}>
              <div className="row g-2 align-items-end">
                <div className="col-auto">
                  <label className="form-label small">Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    required
                  />
                </div>
                <div className="col-auto">
                  <label className="form-label small">Completed</label>
                  <div>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={completed}
                      onChange={e => setCompleted(e.target.checked)}
                    />
                  </div>
                </div>
                <div className="col-auto">
                  <label className="form-label small">Value</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control form-control-sm value-input"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="col">
                  <label className="form-label small">Note</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="col-auto">
                  <button type="submit" className="btn btn-sm btn-primary">
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <h5>Log History</h5>
      {logs.length === 0 ? (
        <p className="text-muted">No log entries yet.</p>
      ) : (
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th className="text-center">Status</th>
              <th>Value</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.uuid}>
                <td>{log.date}</td>
                <td className="text-center">
                  {log.completed ? (
                    <span className="text-success">{"\u2713"}</span>
                  ) : (
                    <span className="text-danger">{"\u2717"}</span>
                  )}
                </td>
                <td>{log.value ?? ""}</td>
                {/* User-owned content rendered with markdown-it - safe to render */}
                <td dangerouslySetInnerHTML={{ __html: markdown.render(log.note) }} />
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
