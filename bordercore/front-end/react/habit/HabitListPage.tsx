import React, { useMemo, useState } from "react";
import { doPost } from "../utils/reactUtils";

interface Habit {
  uuid: string;
  name: string;
  purpose: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  tags: string[];
  total_logs: number;
  completed_logs: number;
  completed_today: boolean;
}

type InactiveSortField = "name" | "start_date" | "end_date";
type SortDirection = "asc" | "desc";

interface HabitListPageProps {
  habits: Habit[];
  logUrl: string;
  detailUrlTemplate: string;
}

function timeAgo(dateStr: string): string {
  const start = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months ago`;
  const years = Math.floor(days / 365.25);
  const remainingMonths = Math.floor((days - years * 365.25) / 30.44);
  if (remainingMonths > 0) return `${years} years, ${remainingMonths} months ago`;
  return `${years} years ago`;
}

export default function HabitListPage({
  habits: initialHabits,
  logUrl,
  detailUrlTemplate,
}: HabitListPageProps) {
  const [habits, setHabits] = useState<Habit[]>(initialHabits);
  const [inactiveSortField, setInactiveSortField] = useState<InactiveSortField>("end_date");
  const [inactiveSortDirection, setInactiveSortDirection] = useState<SortDirection>("desc");

  const today = new Date().toISOString().split("T")[0];

  function getDetailUrl(uuid: string): string {
    return detailUrlTemplate.replace("00000000-0000-0000-0000-000000000000", uuid);
  }

  function handleCheckIn(habit: Habit) {
    const newCompleted = !habit.completed_today;
    doPost(
      logUrl,
      {
        habit_uuid: habit.uuid,
        date: today,
        completed: newCompleted ? "true" : "false",
      },
      () => {
        setHabits(prev =>
          prev.map(h =>
            h.uuid === habit.uuid
              ? {
                  ...h,
                  completed_today: newCompleted,
                  completed_logs: newCompleted ? h.completed_logs + 1 : h.completed_logs - 1,
                  total_logs: h.completed_today ? h.total_logs : h.total_logs + 1,
                }
              : h
          )
        );
      },
      newCompleted ? "Habit logged" : "Log updated"
    );
  }

  const activeHabits = habits.filter(h => h.is_active);

  const inactiveHabits = useMemo(() => {
    const filtered = habits.filter(h => !h.is_active);
    filtered.sort((a, b) => {
      const aVal = (a[inactiveSortField] ?? "").toLowerCase();
      const bVal = (b[inactiveSortField] ?? "").toLowerCase();
      if (aVal < bVal) return inactiveSortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return inactiveSortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [habits, inactiveSortField, inactiveSortDirection]);

  function handleInactiveSort(field: InactiveSortField) {
    if (inactiveSortField === field) {
      setInactiveSortDirection(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setInactiveSortField(field);
      setInactiveSortDirection("asc");
    }
  }

  function getInactiveSortIndicator(field: InactiveSortField) {
    if (inactiveSortField !== field) return null;
    return inactiveSortDirection === "asc" ? " ↑" : " ↓";
  }

  return (
    <div>
      <h4>Active Habits</h4>
      {activeHabits.length === 0 ? (
        <p className="text-muted">No active habits. Create one in the admin.</p>
      ) : (
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Habit</th>
              <th>Tags</th>
              <th className="text-center">Completed</th>
              <th className="text-center">Today</th>
            </tr>
          </thead>
          <tbody>
            {activeHabits.map(habit => (
              <tr key={habit.uuid}>
                <td>
                  <a href={getDetailUrl(habit.uuid)}>{habit.name}</a>
                  <small className="text-info d-block">Started {timeAgo(habit.start_date)}</small>
                  {habit.purpose && <small className="text-muted d-block">{habit.purpose}</small>}
                </td>
                <td>
                  {habit.tags.map(tag => (
                    <span key={tag} className="badge bg-secondary me-1">
                      {tag}
                    </span>
                  ))}
                </td>
                <td className="text-center">
                  {habit.completed_logs} / {habit.total_logs}
                </td>
                <td className="text-center">
                  <button
                    className={`btn btn-sm ${habit.completed_today ? "btn-success" : "btn-outline-secondary"}`}
                    onClick={() => handleCheckIn(habit)}
                    title={habit.completed_today ? "Mark incomplete" : "Mark complete"}
                  >
                    {habit.completed_today ? "\u2713" : "\u2014"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {inactiveHabits.length > 0 && (
        <>
          <h4 className="mt-4">Inactive Habits</h4>
          <table className="table table-sm">
            <thead>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => handleInactiveSort("name")}>
                  Habit{getInactiveSortIndicator("name")}
                </th>
                <th style={{ cursor: "pointer" }} onClick={() => handleInactiveSort("start_date")}>
                  Start Date{getInactiveSortIndicator("start_date")}
                </th>
                <th style={{ cursor: "pointer" }} onClick={() => handleInactiveSort("end_date")}>
                  End Date{getInactiveSortIndicator("end_date")}
                </th>
                <th className="text-center">Completed</th>
              </tr>
            </thead>
            <tbody>
              {inactiveHabits.map(habit => (
                <tr key={habit.uuid} className="text-muted">
                  <td>
                    <a href={getDetailUrl(habit.uuid)}>{habit.name}</a>
                  </td>
                  <td>{habit.start_date}</td>
                  <td>{habit.end_date}</td>
                  <td className="text-center">
                    {habit.completed_logs} / {habit.total_logs}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
