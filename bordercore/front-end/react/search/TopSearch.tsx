import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faSearch, faBook, faBookmark, faStickyNote, faMusic, faGraduationCap, faHeart } from "@fortawesome/free-solid-svg-icons";
import SelectValue, { SelectValueHandle } from "../common/SelectValue";
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
      selectValueRef.current?.focus();
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
    const form = document.querySelector("#top-search form") as HTMLFormElement;
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

    const handleClick = (event: MouseEvent) => {
      const specifiedElement = document.getElementById("top-search");
      if (!specifiedElement) {
        return;
      }
      const target = event.target as HTMLElement;
      const isClickInside =
        specifiedElement.contains(target) ||
        specifiedElement.contains(target.parentElement as HTMLElement);
      if (
        !isClickInside &&
        !target.classList.contains("fa-search") &&
        !target.classList.contains("fa-times") &&
        !target.parentElement?.classList.contains("fa-times") &&
        !target.parentElement?.classList.contains("fa-search")
      ) {
        setShowSearchWindow(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  // Expose showSearchWindow state to parent via effect
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

  if (!showSearchWindow) {
    return null;
  }

  return (
    <div id="top-search" style={{ display: showSearchWindow ? "block" : "none" }}>
      <form className="form-inline" method="get">
        <input type="hidden" name="doctype" value={searchFilter} />
        <div className="form-row">
          <div className="me-1">
            <SelectValue
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
                        <em className="top-search-object-type">{option.doctype} - </em>
                      )}
                      <span className="d-inline" dangerouslySetInnerHTML={{ __html: boldenOption(option.name, search) }} />
                    </div>
                  )}
                </>
              )}
            />
            {searchFilter && (
              <div id="top-search-filter" className="tag label label-info d-flex align-items-center">
                <div>{getFilterName(searchFilter)}</div>
                <div>
                  <a className="ms-1" href="#" onClick={(e) => {
                    e.preventDefault();
                    removeFilter();
                  }}>
                    <FontAwesomeIcon icon={faTimes} className="text-primary" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
      {showFilter && (
        <div id="top-search-filter-options" className="ms-3 mt-2 p-2">
          <div className="search-splitter">Filter Options</div>
          <div className="d-flex flex-column">
            {searchFilterTypes.map((filter) => (
              <div
                key={filter.icon.iconName}
                className={`search-suggestion d-flex ${filter.doctype === searchFilter ? "selected rounded-sm" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleFilter(filter.doctype);
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="top-search-filter-icon d-flex justify-content-center align-items-center">
                  <FontAwesomeIcon className="me-2" icon={filter.icon} />
                </div>
                <div>{filter.name}</div>
              </div>
            ))}
          </div>
          <div className="search-splitter">Recent Searches</div>
          <div className="d-flex flex-column">
            {recentSearches.map((recentSearch) => (
              <div
                key={recentSearch.id}
                className="search-suggestion d-flex"
                onClick={(e) => {
                  e.preventDefault();
                  handleRecentSearch(recentSearch);
                }}
                style={{ cursor: "pointer" }}
              >
                <div className="top-search-filter-icon d-flex justify-content-center align-items-center">
                  <FontAwesomeIcon className="me-2" icon={faSearch} />
                </div>
                <div className="text-truncate">{recentSearch.search_text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default TopSearch;

