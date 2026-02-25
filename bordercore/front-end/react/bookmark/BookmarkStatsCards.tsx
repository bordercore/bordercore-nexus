import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink, faTag, faGlobe, faLinkSlash } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { BookmarkStats } from "./types";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: IconDefinition;
  accentClass: string;
}

function StatCard({ label, value, icon, accentClass }: StatCardProps) {
  return (
    <div className={`bookmark-stat-card ${accentClass}`}>
      <div className="stat-card-content">
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value">{value}</div>
      </div>
      <div className="stat-card-icon">
        <FontAwesomeIcon icon={icon} />
      </div>
    </div>
  );
}

interface BookmarkStatsCardsProps {
  stats: BookmarkStats;
}

export function BookmarkStatsCards({ stats }: BookmarkStatsCardsProps) {
  return (
    <div className="bookmark-stats-row">
      <StatCard
        label="Total Links"
        value={stats.total_count.toLocaleString()}
        icon={faLink}
        accentClass="stat-accent"
      />
      <StatCard
        label="Untagged"
        value={stats.untagged_count.toLocaleString()}
        icon={faTag}
        accentClass="stat-purple"
      />
      <StatCard
        label="Top Domain"
        value={stats.top_domain}
        icon={faGlobe}
        accentClass="stat-green"
      />
      <StatCard
        label="Broken Links"
        value={stats.broken_count.toLocaleString()}
        icon={faLinkSlash}
        accentClass="stat-red"
      />
    </div>
  );
}

export default BookmarkStatsCards;
