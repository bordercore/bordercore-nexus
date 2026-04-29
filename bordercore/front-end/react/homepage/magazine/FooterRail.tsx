import React from "react";
import { MagSection } from "./MagSection";
import { RecentBookmarksList } from "./RecentBookmarksList";
import { ReadingListPills } from "./ReadingListPills";
import type { Bookmark } from "../types";

interface FooterRailProps {
  bookmarks: Bookmark[];
  bookmarkOverviewUrl: string;
  bookmarkClickUrlTemplate: string;
  dailyBookmarks: Bookmark[];
}

export function FooterRail({
  bookmarks,
  bookmarkOverviewUrl,
  bookmarkClickUrlTemplate,
  dailyBookmarks,
}: FooterRailProps) {
  return (
    <div className="mag-footer-rail">
      <MagSection accent="neutral" kicker={<a href={bookmarkOverviewUrl}>Recent Bookmarks</a>}>
        <div className="mag-classifieds">
          <RecentBookmarksList
            bookmarks={bookmarks}
            bookmarkClickUrlTemplate={bookmarkClickUrlTemplate}
          />
        </div>
      </MagSection>

      <MagSection accent="cyan" kicker="today's reading list">
        <ReadingListPills
          bookmarks={dailyBookmarks}
          bookmarkClickUrlTemplate={bookmarkClickUrlTemplate}
        />
      </MagSection>
    </div>
  );
}
