import React, { useState, useEffect, useRef, useCallback } from "react";
import SearchBar, { SearchBarHandle } from "./SearchBar";
import TagSearchResult from "./TagSearchResult";
import { doPost } from "../utils/reactUtils";
import type { TagDetailResults, DoctypeCount, TagCount } from "./types";
import { DOCTYPE_MAPPING } from "./types";

// Declare bootstrap Tab type
declare const bootstrap: {
  Tab: new (element: Element) => { show: () => void };
};

interface TagDetailPageProps {
  results: TagDetailResults;
  doctypeCounts: DoctypeCount[];
  tagCounts: TagCount[];
  initialTags: string[];
  savedTab: string;
  doctypes: string[];
  tagSearchUrl: string;
  tagsChangedUrl: string;
  termSearchUrl: string;
  storeInSessionUrl: string;
}

export function TagDetailPage({
  results,
  doctypeCounts,
  tagCounts,
  initialTags,
  savedTab,
  doctypes,
  tagSearchUrl,
  tagsChangedUrl,
  termSearchUrl,
  storeInSessionUrl,
}: TagDetailPageProps) {
  // Add display names to doctype counts
  const enrichedDoctypeCounts = doctypeCounts.map((doctype) => ({
    key: doctype[0],
    count: doctype[1],
    displayName: DOCTYPE_MAPPING[doctype[0]] || doctype[0],
  }));

  // Initialize with saved tab or first available doctype
  const getInitialDoctype = () => {
    if (savedTab && doctypes.includes(savedTab)) {
      return savedTab;
    }
    return enrichedDoctypeCounts[0]?.key || "";
  };

  const [selectedDoctype, setSelectedDoctype] = useState(getInitialDoctype);
  const searchBarRef = useRef<SearchBarHandle>(null);

  const handleDoctypeSelect = useCallback(
    (doctype: string) => {
      setSelectedDoctype(doctype);

      // Store the selected tab in session
      doPost(
        storeInSessionUrl,
        { search_tag_detail_current_tab: doctype },
        () => {}
      );
    },
    [storeInSessionUrl]
  );

  useEffect(() => {
    // On mount, set up the initial tab
    if (enrichedDoctypeCounts.length > 0) {
      let tabToShow: string;
      let triggerEl: Element | null;

      // If there's a saved tab that matches a current doctype, use it
      if (savedTab && doctypes.includes(savedTab)) {
        tabToShow = savedTab;
        triggerEl = document.querySelector(`div#${savedTab}-tab`);
      } else {
        // Otherwise, select the first tab
        triggerEl = document.querySelector(".nav div:first-child");
        tabToShow = enrichedDoctypeCounts[0]?.key || "";
      }

      if (triggerEl && typeof bootstrap !== "undefined") {
        const tabTrigger = new bootstrap.Tab(triggerEl);
        tabTrigger.show();
        setSelectedDoctype(tabToShow);
      }

      // Focus the tag search input
      searchBarRef.current?.focusTagSearch();
    }
  }, [enrichedDoctypeCounts, savedTab, doctypes]);

  return (
    <div className="row g-0 h-100 mx-2">
      <div className="col-lg-3 d-flex flex-column">
        <div className="card-body flex-grow-1">
          {enrichedDoctypeCounts.length > 0 && (
            <>
              <h4 className="text4 border-bottom pb-2">Doctypes</h4>
              <ul className="list-unstyled">
                {enrichedDoctypeCounts.map((doctype) => {
                  const isSelected = doctype.key === selectedDoctype;
                  return (
                    <li
                      key={doctype.key}
                      id={`${doctype.key}-tab`}
                      className={`list-with-counts rounded d-flex ps-2 py-1 pe-1 ${isSelected ? "selected" : ""}`}
                      onClick={() => handleDoctypeSelect(doctype.key)}
                      data-bs-toggle="tab"
                      data-bs-target={`#${doctype.key}`}
                      style={isSelected ? { backgroundColor: "var(--selected-bg)" } : undefined}
                    >
                      <div className="ps-2">{doctype.displayName}</div>
                      <div className="ms-auto pe-2">
                        <span className="px-2 badge rounded-pill">{doctype.count}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
      <div className="col-lg-9 ps-4">
        <SearchBar
          ref={searchBarRef}
          tagCounts={tagCounts}
          tagSearchUrl={tagSearchUrl}
          tagsChangedUrl={tagsChangedUrl}
          termSearchUrl={termSearchUrl}
          initialTags={initialTags}
        />
        <div className="tab-content ps-3 h-100 mb-3">
          <TagSearchResult docType="blob" matches={results.blob || []} isActive={selectedDoctype === "blob"} />
          <TagSearchResult docType="book" matches={results.book || []} isActive={selectedDoctype === "book"} />
          <TagSearchResult docType="bookmark" matches={results.bookmark || []} isActive={selectedDoctype === "bookmark"} />
          <TagSearchResult docType="document" matches={results.document || []} isActive={selectedDoctype === "document"} />
          <TagSearchResult docType="note" matches={results.note || []} isActive={selectedDoctype === "note"} />
          <TagSearchResult docType="drill" matches={results.drill || []} isActive={selectedDoctype === "drill"} />
          <TagSearchResult docType="song" matches={results.song || []} isActive={selectedDoctype === "song"} />
          <TagSearchResult docType="todo" matches={results.todo || []} isActive={selectedDoctype === "todo"} />
          <TagSearchResult docType="album" matches={results.album || []} isActive={selectedDoctype === "album"} />
        </div>
      </div>
    </div>
  );
}

export default TagDetailPage;
