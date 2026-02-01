import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import RemindersTable, { type Reminder } from "./RemindersTable";

interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_count: number;
  has_previous: boolean;
  has_next: boolean;
  previous_page_number: number | null;
  next_page_number: number | null;
}

interface RemindersResponse {
  reminders: Reminder[];
  pagination: PaginationInfo;
}

interface RemindersPageProps {
  listAjaxUrl: string;
  createUrl: string;
}

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

export function RemindersPage({ listAjaxUrl, createUrl }: RemindersPageProps) {
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [pagination, setPagination] = React.useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const refreshTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const currentPageRef = React.useRef(1);

  const loadReminders = React.useCallback(
    async (page: number = 1) => {
      try {
        setLoading(true);
        const response = await axios.get<RemindersResponse>(`${listAjaxUrl}?page=${page}`);
        setReminders(response.data.reminders);
        setPagination(response.data.pagination);
        setCurrentPage(page);
        currentPageRef.current = page;
      } catch (error) {
        console.error("Error loading reminders:", error);
      } finally {
        setLoading(false);
      }
    },
    [listAjaxUrl]
  );

  // Auto-refresh functionality
  React.useEffect(() => {
    // Load immediately on mount
    loadReminders(1);

    // Set up auto-refresh interval
    refreshTimerRef.current = setInterval(() => {
      loadReminders(currentPageRef.current);
    }, REFRESH_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [loadReminders]);

  // Handle visibility change (stop/start refresh when tab is hidden/visible)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Stop refresh when page is hidden
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      } else {
        // Restart refresh when page becomes visible
        if (!refreshTimerRef.current) {
          loadReminders(currentPageRef.current);
          refreshTimerRef.current = setInterval(() => {
            loadReminders(currentPageRef.current);
          }, REFRESH_INTERVAL);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadReminders]);

  const handlePageChange = (page: number) => {
    loadReminders(page);
  };

  // Calculate pagination range and page numbers to display
  const getPaginationInfo = () => {
    if (!pagination) return { start: 0, end: 0, total: 0, pageNumbers: [] };

    const itemsPerPage = 20; // This should match paginate_by in the view
    const start = (pagination.current_page - 1) * itemsPerPage + 1;
    const end = Math.min(start + reminders.length - 1, pagination.total_count);
    const total = pagination.total_count;

    // Generate page numbers to show
    const pageNumbers: (number | "ellipsis")[] = [];
    const current = pagination.current_page;
    const totalPages = pagination.total_pages;

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Show first page
      pageNumbers.push(1);

      if (current > 3) {
        pageNumbers.push("ellipsis");
      }

      // Show pages around current
      const startPage = Math.max(2, current - 1);
      const endPage = Math.min(totalPages - 1, current + 1);

      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      if (current < totalPages - 2) {
        pageNumbers.push("ellipsis");
      }

      // Show last page
      pageNumbers.push(totalPages);
    }

    return { start, end, total, pageNumbers };
  };

  const paginationInfo = getPaginationInfo();

  return (
    <div className="card-grid ms-2 me-2 mt-2">
      <div className="d-flex justify-content-between mb-3">
        <div>
          <a href={createUrl} className="reminder-new-button">
            <FontAwesomeIcon icon={faPlus} />
            New Reminder
          </a>
        </div>
      </div>

      <div id="reminders-container">
        {loading ? (
          <div className="text-center p-3">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            <RemindersTable data={reminders} />
            {pagination && pagination.total_pages > 1 && (
              <div className="reminders-pagination-footer">
                <p className="pagination-info">
                  Showing{" "}
                  <span className="pagination-count">
                    {paginationInfo.start}-{paginationInfo.end}
                  </span>{" "}
                  of <span className="pagination-count">{paginationInfo.total}</span> reminders
                </p>
                <div className="pagination-controls">
                  <button
                    className="pagination-button pagination-button-icon"
                    onClick={() => handlePageChange(pagination.previous_page_number || 1)}
                    disabled={!pagination.has_previous}
                    aria-label="Previous page"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                  {paginationInfo.pageNumbers.map((pageNum, index) => {
                    if (pageNum === "ellipsis") {
                      return (
                        <span
                          key={`ellipsis-${index}`}
                          className="pagination-button pagination-button-ellipsis"
                        >
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`pagination-button ${pageNum === pagination.current_page ? "pagination-button-active" : ""}`}
                        onClick={() => handlePageChange(pageNum)}
                        aria-label={`Page ${pageNum}`}
                        aria-current={pageNum === pagination.current_page ? "page" : undefined}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    className="pagination-button pagination-button-icon"
                    onClick={() =>
                      handlePageChange(pagination.next_page_number || pagination.total_pages)
                    }
                    disabled={!pagination.has_next}
                    aria-label="Next page"
                  >
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default RemindersPage;
