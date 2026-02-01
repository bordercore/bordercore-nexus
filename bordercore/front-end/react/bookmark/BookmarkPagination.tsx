import React from "react";
import type { Pagination } from "./types";

interface BookmarkPaginationProps {
  pagination: Pagination;
  onGetPage: (pageNumber: number) => void;
}

export function BookmarkPagination({ pagination, onGetPage }: BookmarkPaginationProps) {
  if (!pagination || !pagination.range || pagination.num_pages <= 1) {
    return null;
  }

  const showStartEllipsis =
    pagination.page_number - pagination.paginate_by > 1 && pagination.num_pages > 4;

  const showEndEllipsis =
    pagination.num_pages - pagination.page_number > pagination.paginate_by &&
    pagination.num_pages > 4;

  const showFirstPageLink = pagination.page_number !== pagination.paginate_by + 2;

  const showLastPageLink =
    pagination.num_pages - pagination.page_number !== pagination.paginate_by + 1;

  return (
    <div className="d-flex justify-content-center">
      <div className="ms-3 mt-3">
        <div className="row">
          <nav aria-label="Page navigation">
            <ul className="pagination">
              {/* Previous button */}
              {pagination.previous_page_number ? (
                <li className="page-item">
                  <a
                    className="page-link"
                    onClick={e => {
                      e.preventDefault();
                      onGetPage(pagination.previous_page_number!);
                    }}
                    href="#"
                  >
                    Previous
                  </a>
                </li>
              ) : (
                <li className="disabled page-item">
                  <a className="page-link" href="#">
                    Previous
                  </a>
                </li>
              )}

              {/* Start ellipsis with page 1 */}
              {showStartEllipsis && (
                <>
                  <li className="page-item">
                    <a
                      className="page-link"
                      onClick={e => {
                        e.preventDefault();
                        onGetPage(1);
                      }}
                      href="#"
                    >
                      1
                    </a>
                  </li>
                  {showFirstPageLink && (
                    <li className="disabled page-item">
                      <a className="page-link" href="#">
                        ...
                      </a>
                    </li>
                  )}
                </>
              )}

              {/* Page range */}
              {pagination.range.map(page =>
                pagination.page_number === page ? (
                  <li key={page} className="disabled page-item">
                    <a className="page-link" href="#">
                      {page}
                    </a>
                  </li>
                ) : (
                  <li key={page} className="page-item">
                    <a
                      className="page-link"
                      onClick={e => {
                        e.preventDefault();
                        onGetPage(page);
                      }}
                      href="#"
                    >
                      {page}
                    </a>
                  </li>
                )
              )}

              {/* End ellipsis with last page */}
              {showEndEllipsis && (
                <>
                  {showLastPageLink && (
                    <li className="disabled page-item">
                      <a className="page-link" href="#">
                        ...
                      </a>
                    </li>
                  )}
                  <li className="page-item">
                    <a
                      className="page-link"
                      onClick={e => {
                        e.preventDefault();
                        onGetPage(pagination.num_pages);
                      }}
                      href="#"
                    >
                      {pagination.num_pages}
                    </a>
                  </li>
                </>
              )}

              {/* Next button */}
              {pagination.next_page_number ? (
                <li className="page-item">
                  <a
                    className="page-link"
                    onClick={e => {
                      e.preventDefault();
                      onGetPage(pagination.next_page_number!);
                    }}
                    href="#"
                  >
                    Next
                  </a>
                </li>
              ) : (
                <li className="disabled page-item">
                  <a className="page-link" href="#">
                    Next
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default BookmarkPagination;
