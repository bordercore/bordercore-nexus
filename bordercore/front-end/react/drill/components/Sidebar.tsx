import React from "react";
import StudyScopeNav from "./StudyScopeNav";
import IntervalsBlock from "./IntervalsBlock";
import ByResponseNav from "./ByResponseNav";
import SessionMeta from "./SessionMeta";
import ActivityHeatmap from "./ActivityHeatmap";
import RecentResponses from "./RecentResponses";
import type { DrillPayload } from "../types";

interface Props {
  payload: DrillPayload;
  activeScope: string;
  onSelectScope: (key: string) => void;
}

export default function Sidebar({ payload, activeScope, onSelectScope }: Props) {
  return (
    <aside className="drill-sidebar">
      <StudyScopeNav
        items={payload.studyScope}
        urls={payload.urls}
        activeKey={activeScope}
        onSelect={onSelectScope}
      />
      <IntervalsBlock intervals={payload.intervals} />
      <ByResponseNav counts={payload.responsesByKind} />
      <SessionMeta
        nextDue={payload.nextDue}
        streak={payload.streak}
        reviewedToday={payload.totalProgress.reviewedToday}
        reviewedWeek={payload.totalProgress.reviewedWeek}
      />
      <ActivityHeatmap counts={payload.activity28d} />
      <RecentResponses items={payload.recentResponses} />
    </aside>
  );
}
