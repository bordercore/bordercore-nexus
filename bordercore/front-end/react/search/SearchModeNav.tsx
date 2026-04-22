import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faTag, faBrain } from "@fortawesome/free-solid-svg-icons";

export type SearchMode = "term" | "tag" | "semantic";

interface SearchModeNavProps {
  activeMode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

const MODES: { key: SearchMode; label: string; icon: typeof faMagnifyingGlass }[] = [
  { key: "term", label: "Term Search", icon: faMagnifyingGlass },
  { key: "tag", label: "Tag Search", icon: faTag },
  { key: "semantic", label: "Semantic Search", icon: faBrain },
];

export function SearchModeNav({ activeMode, onModeChange }: SearchModeNavProps) {
  return (
    <div className="search-sidebar-section">
      <h6 className="search-sidebar-label">SEARCH MODE</h6>
      <div className="refined-side-nav">
        {MODES.map(mode => (
          <button
            key={mode.key}
            type="button"
            className={`refined-side-item ${activeMode === mode.key ? "active" : ""}`}
            onClick={() => onModeChange(mode.key)}
            aria-current={activeMode === mode.key ? "true" : undefined}
          >
            <span className="label">
              <FontAwesomeIcon icon={mode.icon} className="search-mode-icon" />
              <span className="text">{mode.label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default SearchModeNav;
