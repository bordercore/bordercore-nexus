import React from "react";

interface BookmarkFilterTitleProps {
  tag: string | null;
  search: string | null;
}

/**
 * Page-title h1 for the bookmark list that surfaces the active filter
 * (e.g. `Bookmarks / Tag / work`, `Bookmarks / Search / django`). Mirrors
 * todo's TodoFilterTitle: despite the `.refined-breadcrumb-h1` styling, none
 * of the spans link anywhere — it's a read-only echo of the current filter.
 * Search takes precedence over a selected tag; "Untagged" is the default
 * landing view and renders without a Kind segment.
 */
export function BookmarkFilterTitle({ tag, search }: BookmarkFilterTitleProps) {
  if (search) {
    return (
      <h1 className="refined-breadcrumb-h1 bookmark-filter-title">
        <span className="dim">Bookmarks</span>
        <span className="sep">/</span>
        <span className="dim">Search</span>
        <span className="sep">/</span>
        <span className="current">{search}</span>
      </h1>
    );
  }

  if (tag && tag !== "Untagged") {
    return (
      <h1 className="refined-breadcrumb-h1 bookmark-filter-title">
        <span className="dim">Bookmarks</span>
        <span className="sep">/</span>
        <span className="dim">Tag</span>
        <span className="sep">/</span>
        <span className="current">{tag}</span>
      </h1>
    );
  }

  if (tag === "Untagged") {
    return (
      <h1 className="refined-breadcrumb-h1 bookmark-filter-title">
        <span className="dim">Bookmarks</span>
        <span className="sep">/</span>
        <span className="current">Untagged</span>
      </h1>
    );
  }

  return (
    <h1 className="refined-breadcrumb-h1 bookmark-filter-title">
      <span className="current neutral">Bookmarks</span>
    </h1>
  );
}

export default BookmarkFilterTitle;
