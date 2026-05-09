import React from "react";
import type { BookmarkStats } from "./types";

type StatTone = "neutral" | "warn" | "danger";

interface StatProps {
  label: string;
  value: string | number;
  tone?: StatTone;
}

// Single label + value entry inside the stats strip. The tone modifier sits
// on the value itself (not the wrapper) because only the numeral changes
// color — the label stays in its muted mono treatment regardless.
function Stat({ label, value, tone = "neutral" }: StatProps) {
  const valueClass =
    tone === "neutral" ? "bookmark-stat-value" : `bookmark-stat-value bookmark-stat-value--${tone}`;
  return (
    <div className="bookmark-stat">
      <span className="bookmark-stat-label">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

interface BookmarkStatsCardsProps {
  stats: BookmarkStats;
}

export function BookmarkStatsCards({ stats }: BookmarkStatsCardsProps) {
  return (
    <div className="bookmark-stats-row">
      <Stat label="Total" value={stats.total_count.toLocaleString()} />
      <Stat label="Untagged" value={stats.untagged_count.toLocaleString()} tone="warn" />
      <Stat label="Top Domain" value={stats.top_domain} />
      <Stat label="Broken" value={stats.broken_count.toLocaleString()} tone="danger" />
    </div>
  );
}

export default BookmarkStatsCards;
