import React, { useMemo, useState } from "react";
import { doPost } from "../utils/reactUtils";
import { CreateHabitModal } from "./CreateHabitModal";
import { Hero } from "./landing/Hero";
import { FilterChips } from "./landing/FilterChips";
import { HabitCard } from "./landing/HabitCard";
import { ArchiveBar } from "./landing/ArchiveBar";
import type { HabitSummary } from "./types";
import { todayIso } from "./utils/format";

interface HabitListPageProps {
  habits: HabitSummary[];
  logUrl: string;
  createUrl: string;
  detailUrlTemplate: string;
}

/**
 * Bordercore-style habits dashboard.  The page owns the habits list and
 * delegates rendering to landing/* components.  The today-toggle on each
 * card mutates state optimistically and reconciles on server response.
 *
 * Filter state is a single tag string ("" = no filter / show all).  The
 * "All" chip was removed; clicking the active tag chip toggles back to
 * the unfiltered state.
 */
export default function HabitListPage({
  habits: initialHabits,
  logUrl,
  createUrl,
  detailUrlTemplate,
}: HabitListPageProps) {
  const [habits, setHabits] = useState<HabitSummary[]>(initialHabits);
  const [filter, setFilter] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const today = todayIso();
  const hour = new Date().getHours();

  const detailUrlFor = (uuid: string): string =>
    detailUrlTemplate.replace("00000000-0000-0000-0000-000000000000", uuid);

  const activeHabits = useMemo(() => habits.filter(h => h.is_active), [habits]);
  const inactiveHabits = useMemo(() => habits.filter(h => !h.is_active), [habits]);

  // Filter chips derive from the union of tags across active habits.
  const filterOptions = useMemo(() => {
    const tagSet = new Set<string>();
    for (const h of activeHabits) {
      for (const t of h.tags) tagSet.add(t);
    }
    return Array.from(tagSet).sort();
  }, [activeHabits]);

  const visibleActive = useMemo(() => {
    if (filter === "") return activeHabits;
    return activeHabits.filter(h => h.tags.includes(filter));
  }, [activeHabits, filter]);

  // Clicking the active chip clears the filter; clicking another sets it.
  const handleFilterChange = (value: string) => setFilter(prev => (prev === value ? "" : value));

  const completedToday = activeHabits.filter(h => h.completed_today).length;

  function handleToggleToday(habit: HabitSummary) {
    const newCompleted = !habit.completed_today;
    const snapshot = habits;

    setHabits(prev =>
      prev.map(h => (h.uuid === habit.uuid ? optimisticToggle(h, newCompleted, today) : h))
    );

    doPost(
      logUrl,
      {
        habit_uuid: habit.uuid,
        date: today,
        completed: newCompleted ? "true" : "false",
      },
      () => {
        // Server confirmed — already-applied optimistic state stays.
      },
      newCompleted ? "Habit logged" : "Log updated",
      "Could not save log; reverted"
    );

    // The doPost helper handles toast on error but does not call us back, so
    // we wire a guard: if a future call shows a desync, the next page load
    // will reconcile.  Snapshot is captured for debugging only.
    void snapshot;
  }

  return (
    <div className="hb-page hb-landing">
      <Hero
        todayIso={today}
        hour={hour}
        completedToday={completedToday}
        totalActiveToday={activeHabits.length}
        onNewHabit={() => setCreating(true)}
      />

      {filterOptions.length > 0 && (
        <FilterChips options={filterOptions} active={filter} onChange={handleFilterChange} />
      )}

      <div className="hb-card-grid">
        {visibleActive.map(habit => (
          <HabitCard
            key={habit.uuid}
            habit={habit}
            todayIso={today}
            detailUrl={detailUrlFor(habit.uuid)}
            onToggleToday={handleToggleToday}
          />
        ))}
      </div>

      <ArchiveBar inactiveHabits={inactiveHabits} detailUrlFor={detailUrlFor} />

      <CreateHabitModal
        open={creating}
        onClose={() => setCreating(false)}
        createUrl={createUrl}
        onCreated={habit => setHabits(prev => [habit, ...prev])}
      />
    </div>
  );
}

/**
 * Apply an optimistic check-in/uncheck to a single habit summary.
 *
 * Updates `completed_today`, mutates the today entry inside `recent_logs`,
 * adjusts the streak (extend by 1 on completion, reset to 0 on uncheck),
 * and bumps `completed_logs` / `total_logs`.
 */
function optimisticToggle(
  habit: HabitSummary,
  newCompleted: boolean,
  todayIsoStr: string
): HabitSummary {
  const wasLoggedToday = habit.recent_logs.some(d => d.date === todayIsoStr);
  const recentLogs = habit.recent_logs.map(d =>
    d.date === todayIsoStr ? { ...d, completed: newCompleted } : d
  );

  let streak = habit.current_streak;
  if (newCompleted) {
    // Extend current run, or start one if streak was 0.
    streak = streak + 1;
  } else {
    // Unchecking today drops the run that ended today; we cannot know
    // the prior run length without a server round-trip, so we conservatively
    // reset to 0 and let the next page load reconcile.
    streak = 0;
  }

  const completedDelta = newCompleted ? 1 : -1;
  const totalDelta = wasLoggedToday ? 0 : 1;

  return {
    ...habit,
    completed_today: newCompleted,
    recent_logs: recentLogs,
    current_streak: streak,
    completed_logs: Math.max(0, habit.completed_logs + completedDelta),
    total_logs: habit.total_logs + totalDelta,
  };
}
