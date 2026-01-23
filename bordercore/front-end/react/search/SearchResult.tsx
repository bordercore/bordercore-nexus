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
  imageSlot,
  extraSlot,
}: SearchResultProps) {
  const iconDefinition = ICON_MAP[icon] || faBook;

  // Note: dangerouslySetInnerHTML is used here because the title may contain
  // highlighted search terms (e.g., <em>search term</em>). This is the same
  // pattern used in the Vue version with v-html. The content is from the
  // backend search engine and is trusted.
  return (
    <div className="d-flex my-1">
      <div className="search-result-icon">
        <FontAwesomeIcon icon={iconDefinition} className="fa-lg text-light" />
      </div>
      {imageSlot}
      <div className="d-flex flex-column ms-2">
        <h4 className="d-flex align-items-center">
          <a
            className="truncate-text"
            href={url}
            dangerouslySetInnerHTML={{ __html: title || "No Title" }}
          />
          {importance > 1 && (
            <FontAwesomeIcon
              icon={faHeart}
              className="favorite mx-2"
              data-bs-toggle="tooltip"
              data-placement="bottom"
              title="Favorite"
            />
          )}
        </h4>
        {extraSlot}
        <div>
          {tags.map((tag) => (
            <a key={tag} href={tagUrl.replace("666", tag)} className="tag">
              {tag}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SearchResult;
