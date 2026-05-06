import React from "react";

interface TopBarProps {
  name: string;
  listUrl: string;
  isActive: boolean;
  onEnd: () => void;
}

/**
 * Detail page top bar: canonical site breadcrumb on the left
 * (habits / {name}), "End habit" button on the right.
 *
 * Uses `.refined-breadcrumb-h1` + `.refined-btn danger` so it matches the
 * pattern used by Todos, Bookmarks, etc.  The breadcrumb's `.current` span
 * carries the habit name; the previous standalone `.hb-detail-title` lived
 * in DetailHeader and was removed to avoid title duplication.
 */
export function TopBar({ name, listUrl, isActive, onEnd }: TopBarProps) {
  return (
    <header className="hb-topbar">
      <h1 className="refined-breadcrumb-h1">
        <a className="dim" href={listUrl}>
          habits
        </a>
        <span className="sep">/</span>
        <span className="current">{name}</span>
      </h1>
      {isActive && (
        <button type="button" className="refined-btn danger" onClick={onEnd}>
          end habit
        </button>
      )}
    </header>
  );
}
