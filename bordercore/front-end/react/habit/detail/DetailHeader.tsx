import React, { useMemo } from "react";
import MarkdownIt from "markdown-it";

interface DetailHeaderProps {
  purpose: string;
  tags: string[];
  isActive: boolean;
  endDate: string | null;
}

/**
 * Tag chips + status pill + markdown-rendered purpose.  The page title
 * itself lives in the breadcrumb (TopBar) so this component no longer owns
 * an `<h1>`.
 */
export function DetailHeader({ purpose, tags, isActive, endDate }: DetailHeaderProps) {
  // markdown-it with default rules: HTML disabled, so user-owned `purpose`
  // text renders to safe markup.  Mirrors the prior HabitDetailPage pattern
  // so existing markdown content keeps its formatting.
  const md = useMemo(() => new MarkdownIt(), []);
  const purposeHtml = useMemo(() => (purpose ? md.render(purpose) : ""), [md, purpose]);

  return (
    <header className="hb-detail-header">
      <div className="hb-detail-tags">
        {tags.map(tag => (
          <span key={tag} className="hb-tag-chip">
            {tag}
          </span>
        ))}
        {isActive ? (
          <span className="hb-status-pill is-active">● Active</span>
        ) : (
          <span className="hb-status-pill is-ended">Ended{endDate ? ` ${endDate}` : ""}</span>
        )}
      </div>
      {purpose && (
        // User-owned content rendered with markdown-it (HTML disabled) - safe to render
        <div className="hb-detail-purpose" dangerouslySetInnerHTML={{ __html: purposeHtml }} />
      )}
    </header>
  );
}
