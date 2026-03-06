import React, { useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import type { Paginator } from "./types";

interface PaginationProps {
  paginator: Paginator;
  onPageChange?: (page: number) => void;
}

export function Pagination({ paginator, onPageChange }: PaginationProps) {
  const getSearchArgs = useCallback(() => {
    const urlSearchParams = new URLSearchParams(window.location.search);
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

  const handleClick = useCallback(
    (e: React.MouseEvent, page: number) => {
      if (onPageChange) {
        e.preventDefault();
        onPageChange(page);
      }
    },
    [onPageChange]
  );

  if (!paginator || !paginator.range || paginator.num_pages <= 1) {
    return null;
  }

  const hasPrevious = paginator.has_previous;
  const hasNext = paginator.has_next;

  // Build page numbers with ellipsis
  const buildPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const current = paginator.page_number;
    const total = paginator.num_pages;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("ellipsis");
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pages.push(i);
      }
      if (current < total - 2) pages.push("ellipsis");
      pages.push(total);
    }
    return pages;
  };

  const pageNumbers = buildPageNumbers();

  return (
    <div className="search-pagination">
      <a
        className={`search-pagination-btn ${!hasPrevious ? "disabled" : ""}`}
        href={hasPrevious ? pageLink(paginator.previous_page_number!) : "#"}
        onClick={hasPrevious ? e => handleClick(e, paginator.previous_page_number!) : undefined}
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </a>

      {pageNumbers.map((page, idx) =>
        page === "ellipsis" ? (
          <span key={`ellipsis-${idx}`} className="search-pagination-ellipsis">
            ...
          </span>
        ) : (
          <a
            key={page}
            className={`search-pagination-btn ${paginator.page_number === page ? "active" : ""}`}
            href={paginator.page_number === page ? "#" : pageLink(page)}
            onClick={paginator.page_number !== page ? e => handleClick(e, page) : undefined}
          >
            {page}
          </a>
        )
      )}

      <a
        className={`search-pagination-btn ${!hasNext ? "disabled" : ""}`}
        href={hasNext ? pageLink(paginator.next_page_number!) : "#"}
        onClick={hasNext ? e => handleClick(e, paginator.next_page_number!) : undefined}
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </a>
    </div>
  );
}

export default Pagination;
