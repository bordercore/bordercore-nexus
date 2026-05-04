import React, { useEffect, useMemo, useState } from "react";
import type { FilterKey, Reminder } from "../types";
import {
  applyFilter,
  bucketReminders,
  countByFilter,
  deriveImminent,
  deriveNextActive,
  deriveStats,
  deriveUpNext,
} from "../grouping";
import { PageHead } from "./PageHead";
import { Toolbar } from "./Toolbar";
import { ReminderList } from "./ReminderList";
import { NextTriggerCard } from "./NextTriggerCard";
import { UpNextCard } from "./UpNextCard";
import { StatsCard } from "./StatsCard";

interface RemindersDashboardProps {
  reminders: Reminder[];
  onNew: () => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (reminder: Reminder) => void;
}

export function RemindersDashboard({
  reminders,
  onNew,
  onEdit,
  onDelete,
}: RemindersDashboardProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let interval = window.setInterval(() => setNow(new Date()), 1000);
    const handleVisibility = () => {
      if (document.hidden) {
        window.clearInterval(interval);
      } else {
        setNow(new Date());
        interval = window.setInterval(() => setNow(new Date()), 1000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const filtered = useMemo(
    () => applyFilter(reminders, filter, query, now),
    [reminders, filter, query, now]
  );
  const groups = useMemo(() => bucketReminders(filtered, now), [filtered, now]);
  const imminent = useMemo(() => deriveImminent(filtered, now), [filtered, now]);
  const nextTriggerReminder = useMemo(
    () => imminent ?? deriveNextActive(filtered, now),
    [imminent, filtered, now]
  );
  const upNext = useMemo(
    () => deriveUpNext(filtered, now, nextTriggerReminder?.uuid ?? null),
    [filtered, now, nextTriggerReminder]
  );
  const stats = useMemo(() => deriveStats(reminders, now), [reminders, now]);
  const counts = useMemo(() => countByFilter(reminders, now), [reminders, now]);

  return (
    <div className="rm-dashboard">
      <div className="rm-list-col">
        <PageHead total={reminders.length} active={stats.active} onNew={onNew} />
        <Toolbar
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setFilter}
          counts={counts}
        />
        <ReminderList
          groups={groups}
          imminentUuid={imminent?.uuid ?? null}
          now={now}
          onEdit={onEdit}
          onDelete={onDelete}
          emptyMessage={
            reminders.length === 0
              ? "Create one to get started."
              : "No reminders match this filter."
          }
        />
      </div>
      <aside className="rm-rail" aria-label="reminders rail">
        <NextTriggerCard reminder={nextTriggerReminder} now={now} />
        <UpNextCard reminders={upNext} now={now} />
        <StatsCard stats={stats} />
      </aside>
    </div>
  );
}

export default RemindersDashboard;
