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

type SortField = "exercise" | "muscle_group" | "last_active" | "schedule";
type SortDirection = "asc" | "desc";

export function FitnessSummaryPage({
  activeExercises,
  inactiveExercises,
}: FitnessSummaryPageProps) {
  const [activeSortField, setActiveSortField] = useState<SortField | null>("schedule");
  const [activeSortDirection, setActiveSortDirection] = useState<SortDirection>("asc");

  const handleActiveSort = (field: SortField) => {
    if (activeSortField === field) {
      setActiveSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setActiveSortField(field);
      setActiveSortDirection("asc");
    }
  };

  const getActiveSortIcon = (field: SortField) => {
    if (activeSortField !== field) return null;
    return activeSortDirection === "asc" ? " ↑" : " ↓";
  };

  const sortedActiveExercises = useMemo(() => {
    if (!activeSortField) return activeExercises;

    return [...activeExercises].sort((a, b) => {
      let comparison = 0;
      if (activeSortField === "exercise") {
        comparison = a.exercise.localeCompare(b.exercise);
      } else if (activeSortField === "muscle_group") {
        comparison = a.muscle_group.localeCompare(b.muscle_group);
      } else if (activeSortField === "last_active") {
        // Handle null last_active by treating it as 0 (old/never)
        const aTime = a.last_active_unixtime ? parseInt(a.last_active_unixtime, 10) : 0;
        const bTime = b.last_active_unixtime ? parseInt(b.last_active_unixtime, 10) : 0;
        comparison = aTime - bTime;
      } else if (activeSortField === "schedule") {
        // Sort by "next scheduled day" relative to today
        // JS getDay(): Sun=0, Mon=1, ... Sat=6
        // Backend/Python convention (likely): Mon=0, Tue=1, ... Sun=6 (based on typical django/python utils)
        // Let's verify: In python datetime.weekday(), Mon=0.
        // So we need to map JS day to Mon-0 index.
        const jsDay = new Date().getDay(); // 0=Sun, 1=Mon...
        // Map 0(Sun)->6, 1(Mon)->0, 2(Tue)->1...
        const currentDayIndex = (jsDay + 6) % 7;

        const getNextDayOffset = (schedule?: boolean[]) => {
          if (!schedule || schedule.length !== 7) return 999; // No schedule = sort last
          for (let i = 0; i < 7; i++) {
            const checkDay = (currentDayIndex + i) % 7;
            if (schedule[checkDay]) return i;
          }
          return 999; // Should not happen if schedule has at least one true, but safe fallback
        };

        const aOffset = getNextDayOffset(a.schedule);
        const bOffset = getNextDayOffset(b.schedule);
        comparison = aOffset - bOffset;
      }
      // For Active Exercises, we don't have a specific sort field for Schedule but can add it if needed.
      // The user asked for "same sort icons as on the todo page", which implies column headers.
      // Let's support "schedule" sorting by string comparison of schedule_days.

      // Note: SortField type needs to include 'schedule' if we sort by it.
      // Currently generic SortField is "exercise" | "muscle_group" | "last_active".
      // I'll add a check for a new field type or reuse existing pattern if I update the type definition.
      // Since I can't easily update the type definition in this Replace block without context of where it is defined (it's above),
      // I will assume for now I will use the existing SortField or cast if necessary, but actually I should update the type definition first ideally.
      // However, looking at the file, SortField is defined locally. I should include that in the edit or make a separate edit.
      // The current SortField is: type SortField = "exercise" | "muscle_group" | "last_active";
      // I'll stick to these for now. If "Schedule" needs sorting, I should add it.
      // The user said "add column sorting... use the same sort icons".
      // I'll add "schedule" to the SortField type in a moment. For now let's implement the sort logic assuming it's there or handled.
      // Actually, to avoid type errors, I should NOT use "schedule" yet if it's not in SortField.
      // I will implement "schedule" sorting if I can update the type.

      return activeSortDirection === "asc" ? comparison : -comparison;
    });
  }, [activeExercises, activeSortField, activeSortDirection]);

  // We need to update existing helper functions or state.
  // ... (rest of the component)

  // Wait, I can't replace the whole component body easily with ReplaceFileContent if I want to insert *inside* the function.
  // The start line 43 is inside the function.
  // I will insert existing state and NEW state.

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

        <div className="fitness-table-container data-table-container">
          <table className="fitness-table data-table">
            <thead>
              <tr>
                <th className="cursor-pointer" onClick={() => handleActiveSort("exercise")}>
                  Exercise{getActiveSortIcon("exercise")}
                </th>
                <th
                  className="text-center cursor-pointer"
                  onClick={() => handleActiveSort("muscle_group")}
                >
                  Muscle Group{getActiveSortIcon("muscle_group")}
                </th>
                <th
                  className="text-center cursor-pointer"
                  onClick={() => handleActiveSort("schedule")}
                >
                  Schedule{getActiveSortIcon("schedule")}
                </th>
                <th
                  className="text-center cursor-pointer"
                  onClick={() => handleActiveSort("last_active")}
                >
                  Last Workout{getActiveSortIcon("last_active")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedActiveExercises.map(row => (
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
              {sortedActiveExercises.length === 0 && (
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

        <div className="fitness-table-container data-table-container">
          <table className="fitness-table data-table">
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
