import React from "react";
import type { ReminderStats } from "../types";

interface StatsCardProps {
  stats: ReminderStats;
}

export function StatsCard({ stats }: StatsCardProps) {
  return (
    <article className="rm-rail-card rm-stats-card" aria-label="reminder stats">
      <div className="rm-stat rm-stat-cyan">
        <span className="rm-stat-num">{stats.active}</span>
        <span className="rm-stat-label">active</span>
      </div>
      <div className="rm-stat rm-stat-purple">
        <span className="rm-stat-num">{stats.today}</span>
        <span className="rm-stat-label">today</span>
      </div>
      <div className="rm-stat">
        <span className="rm-stat-num">{stats.next_7d}</span>
        <span className="rm-stat-label">next 7d</span>
      </div>
    </article>
  );
}

export default StatsCard;
