import React, { useMemo, useRef, useState } from "react";
import { doPost } from "../utils/reactUtils";
import { DeactivateHabitModal, DeactivateHabitModalHandle } from "./DeactivateHabitModal";
import { TopBar } from "./detail/TopBar";
import { DetailHeader } from "./detail/DetailHeader";
import { LogPanel } from "./detail/LogPanel";
import { KpiStrip } from "./detail/KpiStrip";
import { Heatmap } from "./detail/Heatmap";
import { HeatmapInspector } from "./detail/HeatmapInspector";
import { DoseChart, ChartRange } from "./detail/DoseChart";
import { Notebook } from "./detail/Notebook";
import { RecentLogTable } from "./detail/RecentLogTable";
import type { HabitDetail, HabitLogEntry } from "./types";
import { todayIso } from "./utils/format";

interface HabitDetailPageProps {
  habit: HabitDetail;
  logUrl: string;
  setInactiveUrl: string;
  listUrl: string;
}

/**
 * Bordercore-style habit detail page.  Holds the canonical log list and
 * routes mutations through `log_habit` (upsert) so the sticky panel handles
 * both "log today" and "edit any past day" without separate endpoints.
 */
export default function HabitDetailPage({
  habit,
  logUrl,
  setInactiveUrl,
  listUrl,
}: HabitDetailPageProps) {
  const today = todayIso();

  const [logs, setLogs] = useState<HabitLogEntry[]>(habit.logs);
  const [isActive, setIsActive] = useState(habit.is_active);
  const [endDate, setEndDate] = useState(habit.end_date);
  const [currentStreak, setCurrentStreak] = useState(habit.current_streak);
  const [longestStreak, setLongestStreak] = useState(habit.longest_streak);

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [logDate, setLogDate] = useState<string>(today);
  const [chartRange, setChartRange] = useState<ChartRange>("90d");

  const deactivateModalRef = useRef<DeactivateHabitModalHandle>(null);

  const logByDate = useMemo(() => {
    const m = new Map<string, HabitLogEntry>();
    for (const log of logs) m.set(log.date, log);
    return m;
  }, [logs]);

  const completedCount = useMemo(() => logs.filter(l => l.completed).length, [logs]);

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

  function handleSave({
    date,
    completed,
    value,
    note,
  }: {
    date: string;
    completed: boolean;
    value: string;
    note: string;
  }) {
    const params: Record<string, string> = {
      habit_uuid: habit.uuid,
      date,
      completed: completed ? "true" : "false",
    };
    if (value) params.value = value;
    if (note) params.note = note;

    doPost(
      logUrl,
      params,
      response => {
        const newLog: HabitLogEntry = response.data.log;
        setLogs(prev => {
          const filtered = prev.filter(l => l.date !== newLog.date);
          return [newLog, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
        });
        // Reset the panel to today after a successful save unless the user
        // explicitly retargets again.
        setLogDate(today);
        // Keep the heatmap selection on the day they just edited so they
        // can verify the change visually.
        setSelectedDate(date);
        // Streaks need a server-truth refresh after editing past days; we
        // approximate locally so the UI feels responsive.
        if (date === today) {
          setCurrentStreak(s => (completed ? s + 1 : Math.max(0, s - 1)));
        }
        // longestStreak only ever grows from the local edit perspective.
        setLongestStreak(s => Math.max(s, currentStreak + (completed ? 1 : 0)));
      },
      "Log saved"
    );
  }

  const selectedLog = selectedDate ? (logByDate.get(selectedDate) ?? null) : null;
  const editingLog = logByDate.get(logDate) ?? null;

  return (
    <div className="hb-page hb-detail">
      <TopBar
        name={habit.name}
        listUrl={listUrl}
        isActive={isActive}
        onEnd={() => deactivateModalRef.current?.openModal()}
      />

      <DetailHeader
        purpose={habit.purpose}
        tags={habit.tags}
        isActive={isActive}
        endDate={endDate}
      />

      {isActive && (
        <LogPanel
          selectedDate={logDate}
          todayIso={today}
          existingLog={editingLog}
          unit={habit.unit}
          onSave={handleSave}
          onResetToToday={() => setLogDate(today)}
        />
      )}

      <KpiStrip
        startDate={habit.start_date}
        currentStreak={currentStreak}
        longestStreak={longestStreak}
        logs={logs}
      />

      <section className="hb-heatmap-card">
        <div className="hb-heatmap-head">
          <div>
            <div className="hb-heatmap-title-label">Last 365 days</div>
            <div className="hb-heatmap-count">{completedCount} completed</div>
          </div>
          <div className="hb-heatmap-legend">
            <span>Less</span>
            <span className="hb-legend-cell hb-cell is-missed" />
            <span className="hb-legend-cell hb-cell is-l1" />
            <span className="hb-legend-cell hb-cell is-l2" />
            <span className="hb-legend-cell hb-cell is-l3" />
            <span className="hb-legend-cell hb-cell is-l4" />
            <span>More</span>
          </div>
        </div>
        <Heatmap
          logs={logs}
          endDateIso={today}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />
        <HeatmapInspector
          date={selectedDate}
          log={selectedLog}
          unit={habit.unit}
          onEdit={d => setLogDate(d)}
        />
      </section>

      <div className="hb-detail-row">
        <DoseChart
          logs={logs}
          endDateIso={today}
          unit={habit.unit}
          range={chartRange}
          onRangeChange={setChartRange}
        />
        <Notebook logs={logs} />
      </div>

      <RecentLogTable
        logs={logs}
        unit={habit.unit}
        totalCount={logs.length}
        onEdit={d => setLogDate(d)}
      />

      <DeactivateHabitModal ref={deactivateModalRef} onConfirm={handleDeactivate} />
    </div>
  );
}
