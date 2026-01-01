import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSearch, faBook, faBookmark, faStickyNote, faMusic, faGraduationCap, faHeart } from "@fortawesome/free-solid-svg-icons";
import SelectValue, { SelectValueHandle } from "../common/SelectValue";
import { Popover } from "../common/Popover";
import { boldenOption } from "../../util.js";

interface RecentSearch {
  id: string;
  search_text: string;
}

interface TopSearchProps {
  initialSearchFilter?: string;
  initialSearchUrl?: string;
  querySearchUrl?: string;
  noteQuerySearchUrl?: string;
  drillQuerySearchUrl?: string;
  storeInSessionUrl?: string;
  recentSearches?: RecentSearch[];
}

export interface TopSearchHandle {
  showSearchWindow: boolean;
  focusSearch: () => void;
}

export const TopSearch = forwardRef<TopSearchHandle, TopSearchProps>(function TopSearch({
  initialSearchFilter = "",
  initialSearchUrl = "",
  querySearchUrl = "",
  noteQuerySearchUrl = "",
  drillQuerySearchUrl = "",
  storeInSessionUrl = "",
  recentSearches = [],
}: TopSearchProps, ref) {
  const [showFilter, setShowFilter] = useState(true);
  const [showSearchWindow, setShowSearchWindow] = useState(false);
  const [searchFilter, setSearchFilter] = useState(initialSearchFilter);
  const selectValueRef = useRef<SelectValueHandle>(null);

  useImperativeHandle(ref, () => ({
    showSearchWindow: showSearchWindow,
    focusSearch: () => {
      setShowSearchWindow(true);
      setTimeout(() => {
        selectValueRef.current?.focus();
      }, 200);
    },
  }));

  const searchFilterTypes = [
    { name: "Books", icon: faBook, doctype: "book" },
    { name: "Bookmarks", icon: faBookmark, doctype: "bookmark" },
    { name: "Notes", icon: faStickyNote, doctype: "note" },
    { name: "Music", icon: faMusic, doctype: "music" },
    { name: "Drill Questions", icon: faGraduationCap, doctype: "drill" },
  ];

  const searchUrl = `${initialSearchUrl}?doc_type=${searchFilter}&term=`;

  const getFilterName = (doctype: string) => {
    const filter = searchFilterTypes.find((x) => x.doctype === doctype);
    return filter ? filter.name : "";
  };

  const focusSearch = () => {
    if (selectValueRef.current?.focus) {
      selectValueRef.current.focus();
    }
  };

  const handleFilter = (filter: string) => {
    const newFilter = searchFilter === filter ? "" : filter;
    setSearchFilter(newFilter);
    saveSearchFilter(newFilter);
  };

  const handleRecentSearch = (searchTerm: RecentSearch) => {
    window.location.href = `${querySearchUrl}?search=${searchTerm.search_text}`;
  };

  const removeFilter = () => {
    setSearchFilter("");
    handleFilter("");
  };

  const saveSearchFilter = (filter: string) => {
    if (storeInSessionUrl && (window as any).doPost) {
      (window as any).doPost(
        storeInSessionUrl,
        { top_search_filter: filter },
        () => {},
      );
    }
  };

  const handleSelectOption = (selection: any) => {
    if (selection.link) {
      window.location.href = selection.link;
    }
  };

  const handleSearch = (selection: any) => {
    const form = document.querySelector("#top-search-form") as HTMLFormElement;
    if (!form) return;

    const searchInput = document.getElementById("topSearchValue") as HTMLInputElement;
    if (searchInput && selectValueRef.current) {
      searchInput.value = selectValueRef.current.search || "";
    }

    if (searchFilter === "note") {
      form.action = noteQuerySearchUrl;
    } else if (searchFilter === "drill") {
      form.action = drillQuerySearchUrl;
    } else {
      form.action = querySearchUrl;
      for (let i = 0; i < form.elements.length; i++) {
        const element = form.elements[i] as HTMLInputElement;
        if (element.name === "search") {
          element.name = "term_search";
          break;
        }
      }
    }
    form.submit();
  };

  const onKeyDown = (evt: React.KeyboardEvent) => {
    if (evt.code === "KeyN" && evt.altKey) {
      evt.preventDefault();
      handleFilter("note");
    } else if (evt.code === "KeyL" && evt.altKey) {
      evt.preventDefault();
      handleFilter("bookmark");
    } else if (evt.code === "KeyB" && evt.altKey) {
      evt.preventDefault();
      handleFilter("book");
    } else if (evt.code === "KeyM" && evt.altKey) {
      evt.preventDefault();
      handleFilter("music");
    } else if (evt.code === "KeyD" && evt.altKey) {
      evt.preventDefault();
      handleFilter("drill");
    } else if (evt.key === "a" && evt.altKey) {
      evt.preventDefault();
      const topSimpleSuggest = document.getElementById("top-simple-suggest") as HTMLInputElement;
      if (topSimpleSuggest) {
        topSimpleSuggest.select();
      }
    } else if (evt.code === "Escape") {
      setShowSearchWindow(false);
    }
  };

  const onSearchChange = (query: string) => {
    setShowFilter(query === "");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "s" && event.altKey) {
        setShowSearchWindow(true);
        setTimeout(() => {
          focusSearch();
        }, 200);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Expose showSearchWindow state to parent via custom event
  useEffect(() => {
    const handleOpenSearch = () => {
      setShowSearchWindow(true);
      setTimeout(() => {
        selectValueRef.current?.focus();
      }, 200);
    };
    window.addEventListener("openSearchWindow", handleOpenSearch);
    return () => window.removeEventListener("openSearchWindow", handleOpenSearch);
  }, []);

  // Focus input when popover opens and reset filter visibility
  useEffect(() => {
    if (showSearchWindow) {
      // Reset showFilter to true when popover opens
      setShowFilter(true);
      setTimeout(() => {
        selectValueRef.current?.focus();
      }, 100);
    }
  }, [showSearchWindow]);

  const trigger = (
    <span className="top-search-icon">
      <FontAwesomeIcon className="top-search-target glow" icon={faSearch} />
    </span>
  );

  return (
    <Popover
      trigger={trigger}
      open={showSearchWindow}
      onOpenChange={setShowSearchWindow}
      placement="bottom-end"
      offsetDistance={12}
      className="search-popover-container"
    >
      <div id="top-search" className="search-popover-content">
        <form id="top-search-form" className="form-inline w-100" method="get">
          <input type="hidden" name="doctype" value={searchFilter} />
          <div className="search-input-wrapper">
            <SelectValue
              key={showSearchWindow ? "open" : "closed"}
              id="topSearchValue"
              ref={selectValueRef}
              label="name"
              placeHolder="Search"
              searchUrl={searchUrl}
              onKeyDown={onKeyDown}
              onSearch={handleSearch}
              onSearchChange={onSearchChange}
              onSelect={handleSelectOption}
              optionSlot={({ option, search }) => (
                <>
                  {option.splitter ? (
                    <div className="search-splitter">{option.name}</div>
                  ) : (
                    <div className="search-suggestion">
                      {option.important === 10 && (
                        <FontAwesomeIcon icon={faHeart} className="text-danger me-1" />
                      )}
                      {option.doctype && (
                        <em className="search-object-type">{option.doctype} - </em>
                      )}
                      <span className="d-inline" dangerouslySetInnerHTML={{ __html: boldenOption(option.name, search) }} />
                    </div>
                  )}
                </>
              )}
            />
            {searchFilter && (
              <div className="search-active-filter">
                <span className="filter-label">{getFilterName(searchFilter)}</span>
                <button
                  type="button"
                  className="filter-remove"
                  onClick={(e) => {
                    e.preventDefault();
                    removeFilter();
                  }}
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            )}
          </div>
        </form>
        {showFilter && (
          <div className="search-filters-panel w-100">
            <div className="search-section">
              <div className="search-section-title">Filter Options</div>
              <div className="search-filter-list">
                {searchFilterTypes.map((filter) => (
                  <button
                    key={filter.icon.iconName}
                    type="button"
                    className={`search-filter-item ${filter.doctype === searchFilter ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleFilter(filter.doctype);
                    }}
                  >
                    <span className="search-filter-icon">
                      <FontAwesomeIcon icon={filter.icon} />
                    </span>
                    <span className="search-filter-name">{filter.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="search-section">
              <div className="search-section-title">Recent Searches</div>
              <div className="search-recent-list">
                {recentSearches.map((recentSearch) => (
                  <button
                    key={recentSearch.id}
                    type="button"
                    className="search-recent-item"
                    onClick={(e) => {
                      e.preventDefault();
                      handleRecentSearch(recentSearch);
                    }}
                  >
                    <span className="search-recent-icon">
                      <FontAwesomeIcon icon={faSearch} />
                    </span>
                    <span className="search-recent-text">{recentSearch.search_text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Popover>
  );
});

export default TopSearch;
