import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { Card } from "../common/Card";
import { Tooltip } from "bootstrap";
import type { BookshelfPageProps } from "./types";

export function BookshelfPage({
  books,
  tagList,
  totalCount,
  searchTerm,
  selectedTag,
  clearUrl,
}: BookshelfPageProps) {
  const [searchValue, setSearchValue] = useState(searchTerm || "");

  // Initialize Bootstrap tooltips
  useEffect(() => {
    const tooltipElements = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipElements.forEach((el) => {
      new Tooltip(el);
    });

    return () => {
      tooltipElements.forEach((el) => {
        const tooltip = Tooltip.getInstance(el);
        if (tooltip) {
          tooltip.dispose();
        }
      });
    };
  }, [books]);

  const handleTagClick = (tagName: string) => {
    window.location.href = `?tag=${encodeURIComponent(tagName)}`;
  };

  const hasFilter = searchTerm || selectedTag;

  // Determine card title based on filter state
  let cardTitle: React.ReactNode = "Recent Books";
  if (searchTerm) {
    cardTitle = "Search Result";
  } else if (selectedTag) {
    cardTitle = (
      <>
        Books with tag <strong className="text-info">{selectedTag}</strong>
      </>
    );
  }

  return (
    <div className="row g-0 h-100 m-2">
      <div className="col-lg-3 d-flex flex-column">
        <div className="card-body backdrop-filter d-flex align-items-center">
          <div>
            <span className="book_count">{totalCount}</span>
          </div>
          <div className="ms-2">books in collection</div>
        </div>
        <div className="card-body backdrop-filter flex-grow-1 bookmark-pinned-tags">
          <div className="card-title-large">Tag List</div>
          <hr className="divider" />
          <ul className="list-group flex-column w-100">
            {tagList.map((tag) => (
              <li
                key={tag.name}
                className="list-with-counts rounded d-flex ps-2 py-1 pr-1"
                onClick={() => handleTagClick(tag.name)}
              >
                <div className="ps-2 text-truncate">{tag.name}</div>
                <div className="ms-auto pe-2">
                  <span className="px-2 badge rounded-pill">{tag.count}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="col-lg-9 d-flex flex-column">
        <div className="has-search position-relative ms-2 me-0 mb-3">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="search-icon" />
          <form action={window.location.pathname} method="get">
            <input
              type="text"
              name="search"
              className="form-control w-100"
              placeholder="Search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </form>
        </div>
        <Card
          cardClassName="backdrop-filter h-100"
          className="bookmark-pinned-tags"
          titleSlot={
            <div className="card-title-large d-flex">
              <div>{cardTitle}</div>
              {hasFilter && (
                <div className="d-flex ms-auto">
                  <small>
                    <a href={clearUrl} className="text-secondary">
                      Clear
                    </a>
                  </small>
                </div>
              )}
            </div>
          }
        >
          <hr className="divider mb-5" />
          <ul className="d-flex flex-wrap text-center list-unstyled collection-sortable">
            {books.map((book) => (
              <li key={book.uuid} className="mx-3">
                <div className="zoom d-flex flex-column justify-content-top h-100 mb-4">
                  <div>
                    <a href={book.url}>
                      <img src={book.cover_url} alt={book.name || "Book cover"} />
                    </a>
                  </div>
                  <div
                    className="collection-item-name lh-sm mt-1"
                    data-bs-toggle="tooltip"
                    data-bs-placement="top"
                    title={book.name}
                  >
                    <a href={book.url}>{book.name || "No Title"}</a>
                  </div>
                </div>
              </li>
            ))}
            {books.length === 0 && <div>Nothing found</div>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default BookshelfPage;
