import React, { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";

interface SearchNoResultProps {
  title?: string;
  children?: ReactNode;
}

export function SearchNoResult({ title = "Nothing found", children }: SearchNoResultProps) {
  return (
    <div className="search-no-result">
      <div className="search-no-result-icon">
        <FontAwesomeIcon icon={faSearch} />
      </div>
      <h3 className="search-no-result-title">{title}</h3>
      <p className="search-no-result-subtitle">
        Try adjusting your search terms, removing filters, or searching for something else.
      </p>
      {children && <div className="search-no-result-extra">{children}</div>}
    </div>
  );
}

export default SearchNoResult;
