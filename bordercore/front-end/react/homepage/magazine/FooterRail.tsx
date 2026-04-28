import React from "react";
import { RecentBookmarksList } from "./RecentBookmarksList";
import { ExerciseSeverityList } from "./ExerciseSeverityList";
import type { Bookmark, OverdueExercise } from "../types";

interface FooterRailProps {
  bookmarks: Bookmark[];
  bookmarkOverviewUrl: string;
  bookmarkClickUrlTemplate: string;
  overdueExercises: OverdueExercise[];
  exerciseDetailUrlTemplate: string;
}

export function FooterRail({
  bookmarks,
  bookmarkOverviewUrl,
  bookmarkClickUrlTemplate,
  overdueExercises,
  exerciseDetailUrlTemplate,
}: FooterRailProps) {
  return (
    <div className="mag-footer-rail">
      <section>
        <div className="mag-ucase">
          <a href={bookmarkOverviewUrl}>classifieds</a> · recent bookmarks
        </div>
        <div className="mag-classifieds">
          <RecentBookmarksList
            bookmarks={bookmarks}
            bookmarkClickUrlTemplate={bookmarkClickUrlTemplate}
          />
        </div>
      </section>

      <section>
        <div className="mag-ucase is-danger">health watch · overdue</div>
        <div className="mag-tasks-list">
          <ExerciseSeverityList
            exercises={overdueExercises}
            exerciseDetailUrlTemplate={exerciseDetailUrlTemplate}
          />
        </div>
      </section>
    </div>
  );
}
