import React, { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart } from "@fortawesome/free-solid-svg-icons";
import {
  faBook,
  faBookmark,
  faCopy,
  faFolder,
  faGraduationCap,
  faMusic,
  faStickyNote,
  faTasks,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { tagStyle } from "../utils/tagColors";

// Map icon names to FontAwesome icons
const ICON_MAP: Record<string, IconDefinition> = {
  book: faBook,
  bookmark: faBookmark,
  copy: faCopy,
  folder: faFolder,
  "graduation-cap": faGraduationCap,
  music: faMusic,
  "sticky-note": faStickyNote,
  tasks: faTasks,
};

interface SearchResultProps {
  icon: string;
  importance?: number;
  title: string;
  url: string;
  tags: string[];
  tagUrl: string;
  metadata?: string;
  metadataExtra?: string;
  highlightHtml?: string;
  imageSlot?: ReactNode;
  extraSlot?: ReactNode;
}

export function SearchResult({
  icon,
  importance = 1,
  title,
  url,
  tags,
  tagUrl,
  metadata,
  metadataExtra,
  highlightHtml,
  imageSlot,
  extraSlot,
}: SearchResultProps) {
  const iconDefinition = ICON_MAP[icon] || faBook;

  // dangerouslySetInnerHTML usage: title and highlight contain backend-generated HTML
  // with search term highlighting (e.g. <em>term</em>). Content is from the trusted
  // Elasticsearch backend only - never from user input rendered directly.
  return (
    <div className="search-result-inner">
      <div className="search-result-top">
        <div className="search-result-icon-wrap">
          <FontAwesomeIcon icon={iconDefinition} className="search-result-icon-fa" />
        </div>
        <div className="search-result-header-info">
          <h4 className="search-result-title-text">
            <a href={url} dangerouslySetInnerHTML={{ __html: title || "No Title" }} />
            {importance > 1 && (
              <FontAwesomeIcon icon={faHeart} className="favorite mx-2" title="Favorite" />
            )}
          </h4>
          <div className="search-result-meta-line">
            {metadata && <span>{metadata}</span>}
            {metadataExtra && (
              <>
                <span className="search-result-meta-sep">&bull;</span>
                <span>{metadataExtra}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="search-result-body">
        {imageSlot && <div className="search-result-image-wrap">{imageSlot}</div>}
        <div className="search-result-body-text">
          {highlightHtml && (
            <p
              className="search-result-description"
              dangerouslySetInnerHTML={{ __html: highlightHtml }}
            />
          )}
          {extraSlot}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="search-result-tags">
          {tags.map(tag => (
            <a
              key={tag}
              href={tagUrl.replace("666", tag)}
              className="tag"
              style={tagStyle(tag)} // must remain inline
            >
              {tag}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchResult;
