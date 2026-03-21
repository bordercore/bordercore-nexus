import React, { useMemo, useRef, useState } from "react";
import MarkdownIt from "markdown-it";
import { doPost } from "../utils/reactUtils";
import { DeactivateHabitModal, DeactivateHabitModalHandle } from "./DeactivateHabitModal";

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
  setInactiveUrl: string;
  listUrl: string;
}

export default function HabitDetailPage({
  habit,
  logUrl,
  setInactiveUrl,
  listUrl,
}: HabitDetailPageProps) {
  const markdown = useMemo(() => new MarkdownIt(), []);
  const [logs, setLogs] = useState<HabitLog[]>(habit.logs);
  const [isActive, setIsActive] = useState(habit.is_active);
  const [endDate, setEndDate] = useState(habit.end_date);
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [completed, setCompleted] = useState(true);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const deactivateModalRef = useRef<DeactivateHabitModalHandle>(null);

  function handleDeactivate() {
    doPost(
      setInactiveUrl,
      { habit_uuid: habit.uuid },
      response => {
        setIsActive(false);
        setEndDate(response.data.end_date);
      },
      "Habit deactivated"
    );
  }

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
          {endDate && (
            <span>
              <span className="text-info">Ended:</span> {endDate}
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

      {isActive && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="card-title mb-0">Log Entry</h5>
              <button
                type="button"
                className="btn btn-sm btn-warning"
                onClick={() => deactivateModalRef.current?.openModal()}
              >
                Mark Inactive
              </button>
            </div>
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

      <DeactivateHabitModal ref={deactivateModalRef} onConfirm={handleDeactivate} />
    </div>
  );
}
