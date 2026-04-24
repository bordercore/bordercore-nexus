import React, { useCallback, useRef, useState } from "react";
import RingDefs from "./components/RingDefs";
import Sidebar from "./components/Sidebar";
import ActionCard from "./components/ActionCard";
import ProgressCard from "./components/ProgressCard";
import ScheduleStrip from "./components/ScheduleStrip";
import TagsNeedingReview from "./components/TagsNeedingReview";
import PinnedTagsCard from "./components/PinnedTagsCard";
import FeaturedTagCard from "./components/FeaturedTagCard";
import DisabledTagsCard from "./components/DisabledTagsCard";
import StudyModal, { StudyModalHandle } from "./components/StudyModal";
import type { DrillPayload } from "./types";
import { pluralize } from "./utils";

const VALID_METHODS = new Set(["all", "favorites", "recent", "tag", "random", "keyword"]);
function normalizedScope(key: string): string {
  if (key === "review") return "all"; // sidebar "review" maps to method=all + filter=review
  return VALID_METHODS.has(key) ? key : "all";
}

interface Props {
  payload: DrillPayload;
}

export default function DrillOverviewPage({ payload }: Props) {
  const [activeScope, setActiveScope] = useState<string>(payload.session?.type ?? "all");
  const studyModalRef = useRef<StudyModalHandle>(null);

  const startStudy = useCallback(() => {
    studyModalRef.current?.show();
  }, []);

  const newQuestion = useCallback(() => {
    window.location.href = payload.urls.drillAdd;
  }, [payload.urls.drillAdd]);

  const overdueDays = payload.schedule.filter(d => d.state === "over").length;

  const today = new Date();
  const monday = new Date(today);
  // Sunday getDay() is 0; shift back 6 days to reach the prior Monday. Other
  // days are `today.getDate() - today.getDay() + 1` for the current week's Monday.
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  monday.setDate(today.getDate() + mondayOffset);
  const weekLabel = `week of ${monday
    .toLocaleString("en", { month: "short" })
    .toLowerCase()} ${monday.getDate()}`;

  return (
    <div className="drill-shell">
      <RingDefs />
      <Sidebar payload={payload} activeScope={activeScope} onSelectScope={setActiveScope} />
      <main className="drill-main">
        <div className="drill-page-head">
          <h1>
            Drill <span className="dim">— spaced-repetition overview</span>
          </h1>
          <p>
            Review your overdue tags, drill on a category, or start a global session. Intervals
            advance on <code>easy</code>/<code>good</code> and step back on <code>hard</code>.
          </p>
        </div>

        <div className="drill-hero">
          <ActionCard
            streak={payload.streak}
            session={payload.session}
            urls={payload.urls}
            onStudy={startStudy}
            onNewQuestion={newQuestion}
          />
          <ProgressCard
            label="total progress"
            meta={`${payload.totalProgress.total} ${pluralize("question", payload.totalProgress.total)}`}
            data={payload.totalProgress}
            variant="purple"
            desc="Portion of your library not currently needing review."
            split={[
              { k: "today", v: `${payload.totalProgress.reviewedToday}q` },
              { k: "7d", v: `${payload.totalProgress.reviewedWeek}q` },
            ]}
          />
          <ProgressCard
            label="favorites progress"
            meta={`${payload.favoritesProgress.total} starred`}
            data={payload.favoritesProgress}
            variant="cyan"
            desc="Portion of your starred questions currently on schedule."
            split={[
              { k: "due", v: `${payload.favoritesProgress.remaining}q` },
              {
                k: "done",
                v: `${payload.favoritesProgress.total - payload.favoritesProgress.remaining}q`,
              },
            ]}
          />
        </div>

        <ScheduleStrip days={payload.schedule} overdueDays={overdueDays} weekLabel={weekLabel} />

        <div className="drill-body-grid">
          <TagsNeedingReview tags={payload.tagsNeedingReview} />
          <div className="drill-side-stack">
            <PinnedTagsCard urls={payload.urls} />
            {payload.featured && (
              <FeaturedTagCard
                initial={payload.featured}
                tagSearchUrl={payload.urls.tagSearch}
                featuredTagInfoUrl={payload.urls.featuredTagInfo}
              />
            )}
            <DisabledTagsCard urls={payload.urls} />
          </div>
        </div>
      </main>
      <StudyModal
        ref={studyModalRef}
        initialMethod={normalizedScope(activeScope)}
        startStudySessionUrl={payload.urls.startStudySession}
        tagSearchUrl={payload.urls.tagSearch}
      />
    </div>
  );
}
