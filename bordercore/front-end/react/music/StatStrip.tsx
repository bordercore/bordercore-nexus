import React from "react";
import type { DashboardStats } from "./types";

interface Props {
  stats: DashboardStats;
}

const StatStrip: React.FC<Props> = ({ stats }) => {
  return (
    <div className="mlo-stat-strip">
      <div className="mlo-stat">
        <div className="mlo-stat-label">plays this week</div>
        <div className="mlo-stat-value">{stats.plays_this_week}</div>
        <div className="mlo-stat-hint">{stats.plays_today} today</div>
      </div>
      <div className="mlo-stat">
        <div className="mlo-stat-label">top tag (7d)</div>
        <div className="mlo-stat-value">{stats.top_tag_7d ? stats.top_tag_7d.name : "—"}</div>
        <div className="mlo-stat-hint">
          {stats.top_tag_7d ? `${stats.top_tag_7d.count} plays` : ""}
        </div>
      </div>
      <div className="mlo-stat">
        <div className="mlo-stat-label">added this month</div>
        <div className="mlo-stat-value">{stats.added_this_month}</div>
        <div className="mlo-stat-hint">albums</div>
      </div>
      <div className="mlo-stat">
        <div className="mlo-stat-label">longest streak</div>
        <div className="mlo-stat-value">{stats.longest_streak}</div>
        <div className="mlo-stat-hint">consecutive days</div>
      </div>
    </div>
  );
};

export default StatStrip;
