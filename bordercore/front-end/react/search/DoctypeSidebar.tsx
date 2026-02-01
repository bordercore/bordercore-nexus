import React, { useCallback } from "react";
import type { Aggregation } from "./types";

interface DoctypeSidebarProps {
  aggregations: Aggregation[];
  currentDoctype: string;
  onDoctypeSelect: (doctype: string) => void;
  hasResults: boolean;
}

export function DoctypeSidebar({
  aggregations,
  currentDoctype,
  onDoctypeSelect,
  hasResults,
}: DoctypeSidebarProps) {
  const handleClick = useCallback(
    (doctype: string) => {
      onDoctypeSelect(doctype);
    },
    [onDoctypeSelect]
  );

  // Capitalize first letter of doctype for display
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  return (
    <div className="col-lg-3 d-flex flex-column">
      <div className="card-body flex-grow-1">
        {hasResults ? (
          <>
            <h4 className="border-bottom pb-2">Blob Type</h4>
            <ul className="list-unstyled">
              {aggregations.map(doctype => (
                <li
                  key={doctype.doctype}
                  className={`list-with-counts rounded d-flex ps-2 py-1 pe-1 ${
                    currentDoctype === doctype.doctype ? "selected" : ""
                  }`}
                  onClick={() => handleClick(doctype.doctype)}
                >
                  <div className="ps-2">{capitalize(doctype.doctype)}</div>
                  <div className="ms-auto pe-2">
                    <span className="px-2 badge rounded-pill">{doctype.count}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            Choose <strong>term search</strong> to search for objects which contain exact words or
            phrases.
            <hr className="divider my-3" />
            Choose <strong>tag search</strong> to search for objects associated with a given tag or
            tags.
          </>
        )}
      </div>
    </div>
  );
}

export default DoctypeSidebar;
