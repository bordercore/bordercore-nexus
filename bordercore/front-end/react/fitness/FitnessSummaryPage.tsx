import React, { useState, useMemo } from "react";
import { Exercise } from "./types";

interface FitnessSummaryPageProps {
  activeExercises: Exercise[];
  inactiveExercises: Exercise[];
}

function getFormattedDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

function getFrequency(row: Exercise): string {
  if (row.delta_days === 0) {
    return "Today";
  }
  return `${row.delta_days} ${pluralize("day", row.delta_days || 0)} ago`;
}

function getRowClass(row: Exercise): string {
  if (row.overdue === 1) return "selected";
  if (row.overdue === 2) return "overdue";
  return "";
}

type SortField = "exercise" | "muscle_group" | "last_active";
type SortDirection = "asc" | "desc";

export function FitnessSummaryPage({
  activeExercises,
  inactiveExercises,
}: FitnessSummaryPageProps) {
  const [sortField, setSortField] = useState<SortField>("exercise");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedInactiveExercises = useMemo(() => {
    return [...inactiveExercises].sort((a, b) => {
      let comparison = 0;
      if (sortField === "exercise") {
        comparison = a.exercise.localeCompare(b.exercise);
      } else if (sortField === "muscle_group") {
        comparison = a.muscle_group.localeCompare(b.muscle_group);
      } else if (sortField === "last_active") {
        const aTime = parseInt(a.last_active_unixtime || "0", 10);
        const bTime = parseInt(b.last_active_unixtime || "0", 10);
        comparison = aTime - bTime;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [inactiveExercises, sortField, sortDirection]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="card-grid ms-3">
      <div className="me-3">
        <h1>Active Exercises</h1>

        <div className="fitness-table-container">
          <table className="fitness-table">
            <thead>
              <tr>
                <th>Exercise</th>
                <th className="text-center">Muscle Group</th>
                <th className="text-center">Schedule</th>
                <th className="text-center">Last Workout</th>
              </tr>
            </thead>
            <tbody>
              {activeExercises.map(row => (
                <tr key={row.exercise_url} className={getRowClass(row)}>
                  <td>
                    <a href={row.exercise_url}>{row.exercise}</a>
                    {row.overdue === 2 && <span className="text-warning ms-3">OVERDUE</span>}
                  </td>
                  <td className="fitness-col-muscle-group text-center">{row.muscle_group}</td>
                  <td className="fitness-col-schedule text-center">{row.schedule_days}</td>
                  <td>
                    {row.last_active ? (
                      <div className="d-flex">
                        <div className="text-nowrap me-3">{getFormattedDate(row.last_active)}</div>
                        <div className="text-nowrap ms-auto">{getFrequency(row)}</div>
                      </div>
                    ) : (
                      <div>Never</div>
                    )}
                  </td>
                </tr>
              ))}
              {activeExercises.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center">
                    No active exercises
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h1 className="mt-3">Inactive Exercises</h1>

        <div className="fitness-table-container">
          <table className="fitness-table">
            <thead>
              <tr>
                <th className="cursor-pointer" onClick={() => handleSort("exercise")}>
                  Exercise{getSortIcon("exercise")}
                </th>
                <th
                  className="text-center cursor-pointer"
                  onClick={() => handleSort("muscle_group")}
                >
                  Muscle Group{getSortIcon("muscle_group")}
                </th>
                <th
                  className="text-center cursor-pointer"
                  onClick={() => handleSort("last_active")}
                >
                  Last Workout{getSortIcon("last_active")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedInactiveExercises.map(row => (
                <tr key={row.exercise_url}>
                  <td>
                    <a href={row.exercise_url}>{row.exercise}</a>
                  </td>
                  <td className="text-center">{row.muscle_group}</td>
                  <td>
                    {row.last_active ? (
                      <div className="d-flex">
                        <div className="text-nowrap me-3">{row.last_active}</div>
                        <div className="text-nowrap ms-auto">{getFrequency(row)}</div>
                      </div>
                    ) : (
                      <div>Never</div>
                    )}
                  </td>
                </tr>
              ))}
              {sortedInactiveExercises.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center">
                    No inactive exercises
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FitnessSummaryPage;
