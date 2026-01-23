import React, { useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import type { Paginator } from "./types";

interface PaginationProps {
  paginator: Paginator;
}

export function Pagination({ paginator }: PaginationProps) {
  // Build URL preserving existing search params
  const getSearchArgs = useCallback(() => {
    const urlSearchParams = new URLSearchParams(window.location.search);
    // The Pagination component will add the "page" searcharg, so we need to delete it first
    urlSearchParams.delete("page");
    const params = urlSearchParams.toString();
    return params ? `&${params}` : "";
  }, []);

  const pageLink = useCallback(
    (pageNumber: number) => {
      return `?page=${pageNumber}${getSearchArgs()}`;
    },
    [getSearchArgs]
  );

  // Handle missing or incomplete paginator
  if (!paginator || !paginator.range || paginator.num_pages <= 1) {
    return null;
  }

  const hasPrevious = paginator.has_previous;
  const hasNext = paginator.has_next;

  return (
    <div className="pagination-container">
      <nav className="mb-5 navigation">
        <ul className="pagination justify-content-center">
          <li className={`page-item ${!hasPrevious ? "disabled" : ""}`}>
            <a className="page-link" href={hasPrevious ? pageLink(paginator.previous_page_number!) : "#"}>
              <FontAwesomeIcon icon={faChevronLeft} className="text-emphasis" />
            </a>
          </li>
          <li className="pagination-divider">
            <div className="w-100 h-75" />
          </li>

          {paginator.range.map((page) => (
            <li
              key={page}
              className={`page-item ${paginator.page_number === page ? "disabled" : ""}`}
            >
              <a className="page-link" href={pageLink(page)}>
                {page}
              </a>
            </li>
          ))}

          <li className="pagination-divider">
            <div className="w-100 h-75" />
          </li>
          <li className={`page-item ${!hasNext ? "disabled" : ""}`}>
            <a className="page-link" href={hasNext ? pageLink(paginator.next_page_number!) : "#"}>
              <FontAwesomeIcon icon={faChevronRight} className="text-emphasis" />
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default Pagination;
