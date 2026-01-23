import React, { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";

interface SearchNoResultProps {
  title?: string;
  children?: ReactNode;
}

export function SearchNoResult({ title = "Nothing found", children }: SearchNoResultProps) {
  return (
    <div className="notice-big alert d-flex">
      <h3>
        <FontAwesomeIcon icon={faSearch} />
      </h3>
      <div className="message ms-2">
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default SearchNoResult;
