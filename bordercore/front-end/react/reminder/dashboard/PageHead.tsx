import React, { useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faSearch } from "@fortawesome/free-solid-svg-icons";
import { useFocusOnCtrlK } from "../../common/hooks/useFocusOnCtrlK";

interface PageHeadProps {
  total: number;
  active: number;
  query: string;
  onQueryChange: (q: string) => void;
  onNew: () => void;
  children?: React.ReactNode;
}

export function PageHead({ total, active, query, onQueryChange, onNew, children }: PageHeadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useFocusOnCtrlK(inputRef);
  return (
    <header className="rm-page-head">
      <div className="rm-page-head-text">
        <h1>
          <span className="bc-page-title">Reminders</span>
        </h1>
        <p className="rm-page-head-sub">
          <span className="count">{total}</span> total · <span className="count">{active}</span>{" "}
          active
        </p>
      </div>
      <div className="rm-page-head-bottom">
        {children}
        <div className="rm-page-head-actions">
          <label className="rm-search">
            <FontAwesomeIcon icon={faSearch} className="rm-search-icon" />
            <input
              ref={inputRef}
              type="search"
              autoComplete="off"
              placeholder="filter reminders · fuzzy match name + note"
              aria-label="filter reminders"
              value={query}
              onChange={e => onQueryChange(e.target.value)}
            />
          </label>
          <button type="button" className="refined-btn primary" onClick={onNew}>
            <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />
            new
          </button>
        </div>
      </div>
    </header>
  );
}

export default PageHead;
