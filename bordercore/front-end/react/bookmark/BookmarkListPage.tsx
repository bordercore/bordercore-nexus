import React, { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTags, faTimes, faThumbTack, faPlus } from "@fortawesome/free-solid-svg-icons";
import hotkeys from "hotkeys-js";
import { SelectValue, SelectValueHandle } from "../common/SelectValue";
import { DropDownMenu } from "../common/DropDownMenu";
import { doGet, doDelete, doPost } from "../utils/reactUtils";
import { EventBus } from "../utils/reactUtils";
import BookmarkPinnedTags from "./BookmarkPinnedTags";
import BookmarkList from "./BookmarkList";
import BookmarkPagination from "./BookmarkPagination";
import type { Bookmark, PinnedTag, Pagination, ViewType } from "./types";

interface BookmarkListPageProps {
  initialTag: string | null;
  initialPinnedTags: PinnedTag[];
  untaggedCount: number;
  initialViewType: ViewType;
  urls: {
    getBookmarksByPage: string;
    getBookmarksByTag: string;
    getBookmarksByKeyword: string;
    getTagsUsedByBookmarks: string;
    bookmarkDetail: string;
    bookmarkUpdate: string;
    bookmarkCreate: string;
    bookmarkSort: string;
    addTag: string;
    removeTag: string;
    sortPinnedTags: string;
    pinTag: string;
    unpinTag: string;
    storeInSession: string;
  };
}

export function BookmarkListPage({
  initialTag,
  initialPinnedTags,
  untaggedCount,
  initialViewType,
  urls,
}: BookmarkListPageProps) {
  const [bookmarkList, setBookmarkList] = useState<Bookmark[]>([]);
  const [selectedTagName, setSelectedTagName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    num_pages: 0,
    page_number: 1,
    paginate_by: 20,
    previous_page_number: null,
    next_page_number: null,
    range: [],
  });
  const [selectedBookmarkUuid, setSelectedBookmarkUuid] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>(initialViewType);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pinnedTags, setPinnedTags] = useState<PinnedTag[]>(() => {
    // Add "Untagged" as the first item
    return [{ id: -1, name: "Untagged", bookmark_count: untaggedCount }, ...initialPinnedTags];
  });

  const selectValueRef = useRef<SelectValueHandle>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  // Deselect bookmark when any element gets focus
  useEffect(() => {
    const handleFocusIn = () => {
      setSelectedBookmarkUuid(null);
    };

    document.addEventListener("focusin", handleFocusIn);
    return () => document.removeEventListener("focusin", handleFocusIn);
  }, []);

  // Initial load
  useEffect(() => {
    if (initialTag) {
      getBookmarkList({ searchTag: initialTag });
    } else {
      getBookmarkList({ pageNumber: 1 });
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    hotkeys("alt+down,alt+up,d,o,escape", function (event, handler) {
      switch (handler.key) {
        case "alt+down":
          if (!selectedBookmarkUuid) {
            if (bookmarkList.length > 0) {
              setSelectedBookmarkUuid(bookmarkList[0].uuid);
            }
          } else {
            const nextUuid = getNextBookmark();
            if (nextUuid) setSelectedBookmarkUuid(nextUuid);
          }
          break;
        case "alt+up":
          if (!selectedBookmarkUuid) {
            if (bookmarkList.length > 0) {
              setSelectedBookmarkUuid(bookmarkList[bookmarkList.length - 1].uuid);
            }
          } else {
            const prevUuid = getPreviousBookmark();
            if (prevUuid) setSelectedBookmarkUuid(prevUuid);
          }
          break;
        case "d":
          if (selectedBookmarkUuid) {
            const nextUuid = getNextBookmark();
            handleDeleteBookmark(selectedBookmarkUuid);
            setSelectedBookmarkUuid(nextUuid || null);
          }
          break;
        case "o":
          if (selectedBookmarkUuid) {
            const bookmark = bookmarkList.find(b => b.uuid === selectedBookmarkUuid);
            if (bookmark) {
              window.open(bookmark.url, "_blank");
              handleDeleteBookmark(bookmark.uuid);
              setSelectedBookmarkUuid(null);
            }
          }
          break;
        case "escape":
          setSelectedBookmarkUuid(null);
          break;
      }
    });

    return () => {
      hotkeys.unbind("alt+down,alt+up,d,o,escape");
    };
  }, [selectedBookmarkUuid, bookmarkList]);

  // Close drawer when tag is selected on mobile
  useEffect(() => {
    if (drawerOpen && window.innerWidth < 992) {
      setDrawerOpen(false);
    }
  }, [selectedTagName]);

  const getNextBookmark = useCallback((): string | null => {
    if (!selectedBookmarkUuid) return null;
    const index = bookmarkList.findIndex(e => e.uuid === selectedBookmarkUuid);
    if (index < bookmarkList.length - 1) {
      return bookmarkList[index + 1].uuid;
    }
    return null;
  }, [selectedBookmarkUuid, bookmarkList]);

  const getPreviousBookmark = useCallback((): string | null => {
    if (!selectedBookmarkUuid) return null;
    const index = bookmarkList.findIndex(e => e.uuid === selectedBookmarkUuid);
    if (index > 0) {
      return bookmarkList[index - 1].uuid;
    }
    return null;
  }, [selectedBookmarkUuid, bookmarkList]);

  const getBookmarkList = useCallback(
    ({
      pageNumber = 1,
      searchTermParam = null,
      searchTag = null,
    }: {
      pageNumber?: number;
      searchTermParam?: string | null;
      searchTag?: string | null;
    } = {}) => {
      let url: string;

      if (searchTag !== null) {
        url = urls.getBookmarksByTag.replace("666", encodeURIComponent(searchTag));
      } else if (searchTermParam !== null && searchTermParam !== "") {
        url = urls.getBookmarksByKeyword.replace("666", encodeURIComponent(searchTermParam));
      } else {
        url = urls.getBookmarksByPage.replace("666", pageNumber.toString());
      }

      doGet(
        url,
        response => {
          // For bookmarks which share the same date, only show the
          // date for the first one, to reduce UI clutter.
          const bookmarks: Bookmark[] = [];
          let lastDate: string | null = null;
          for (const bookmark of response.data.bookmarks) {
            if (bookmark.created === lastDate) {
              lastDate = bookmark.created;
              bookmark.created = null;
            } else {
              lastDate = bookmark.created;
            }
            bookmarks.push(bookmark);
          }

          setSearchTerm(searchTermParam);
          setBookmarkList(bookmarks);
          setPagination(response.data.pagination);

          if (searchTag !== null) {
            setSelectedTagName(searchTag);
          } else if (searchTermParam !== null) {
            setSelectedTagName(null);
          } else {
            setSelectedTagName("Untagged");

            // Auto-refresh on Untagged page 1
            if (
              Object.keys(response.data.pagination).length === 0 ||
              response.data.pagination.page_number === 1
            ) {
              // Clear any existing timeouts
              if (intervalIdRef.current) {
                clearTimeout(intervalIdRef.current);
              }
              intervalIdRef.current = window.setTimeout(
                () => getBookmarkList({ pageNumber }),
                60000
              );
            }
          }
        },
        "Error getting bookmarks list"
      );
    },
    [urls]
  );

  const getPage = useCallback(
    (pageNumber: number) => {
      if (intervalIdRef.current) {
        clearTimeout(intervalIdRef.current);
      }
      getBookmarkList({ pageNumber });
    },
    [getBookmarkList]
  );

  const searchTag = useCallback(
    (tagName: string) => {
      if (intervalIdRef.current) {
        clearTimeout(intervalIdRef.current);
      }

      if (tagName === "Untagged") {
        getBookmarkList({ pageNumber: 1 });
      } else {
        getBookmarkList({ searchTag: tagName });
      }
    },
    [getBookmarkList]
  );

  const handleSearch = useCallback(
    (query: string | { label?: string }) => {
      const searchTermParam = typeof query === "string" ? query : query.label || "";
      if (searchTermParam) {
        getBookmarkList({ searchTermParam: searchTermParam });
      } else {
        getBookmarkList({ pageNumber: 1 });
      }
    },
    [getBookmarkList]
  );

  const selectTag = useCallback(
    (tagInfo: { label?: string }) => {
      searchTag(tagInfo.label || "");
    },
    [searchTag]
  );

  const removeFilter = useCallback(() => {
    setSearchTerm(null);
    searchTag("Untagged");
  }, [searchTag]);

  const handleDeleteBookmark = useCallback(
    (uuid: string) => {
      const deleteUrl = urls.bookmarkDetail.replace("00000000-0000-0000-0000-000000000000", uuid);

      doDelete(
        deleteUrl,
        () => {
          EventBus.$emit("toast", {
            body: "Bookmark deleted",
          });

          if (selectedTagName) {
            if (selectedTagName === "Untagged") {
              getBookmarkList({ pageNumber: pagination.page_number });
            } else {
              getBookmarkList({ searchTag: selectedTagName });
            }
          } else {
            getBookmarkList({ pageNumber: pagination.page_number });
          }
        },
        ""
      );
    },
    [selectedTagName, pagination.page_number, urls, getBookmarkList]
  );

  const handleEditBookmark = useCallback(
    (uuid: string) => {
      window.location.href = urls.bookmarkUpdate.replace(
        "00000000-0000-0000-0000-000000000000",
        uuid
      );
    },
    [urls]
  );

  const handleClickBookmark = useCallback((uuid: string) => {
    setSelectedBookmarkUuid(uuid);
  }, []);

  const switchViewType = useCallback(
    (type: ViewType) => {
      setViewType(type);
      doPost(urls.storeInSession, { bookmark_view_type: type }, () => {});
    },
    [urls]
  );

  const toggleDrawer = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  const tagIsSelected = selectedTagName !== null && selectedTagName !== "Untagged";

  const isPinned = pinnedTags.some(t => t.name === selectedTagName);

  const handleTogglePinStatus = useCallback(() => {
    const formAction = isPinned ? urls.unpinTag : urls.pinTag;

    // Create and submit a form
    const form = document.createElement("form");
    form.method = "post";
    form.action = formAction;

    // Add CSRF token
    const csrfInput = document.createElement("input");
    csrfInput.type = "hidden";
    csrfInput.name = "csrfmiddlewaretoken";
    const csrfToken =
      document.querySelector<HTMLInputElement>('input[name="csrfmiddlewaretoken"]')?.value || "";
    csrfInput.value = csrfToken;
    form.appendChild(csrfInput);

    // Add tag name
    const tagInput = document.createElement("input");
    tagInput.type = "hidden";
    tagInput.name = "tag";
    tagInput.value = selectedTagName || "";
    form.appendChild(tagInput);

    document.body.appendChild(form);
    form.submit();
  }, [isPinned, selectedTagName, urls]);

  return (
    <div id="bookmark-list-page" className="row g-0 h-100 mx-2">
      {/* Tags drawer overlay (for mobile) */}
      {drawerOpen && <div className="bookmark-tags-drawer-overlay" onClick={toggleDrawer} />}

      {/* Tags section - hidden on small screens, shown in drawer */}
      <div
        className={`col-lg-3 d-flex flex-column bookmark-tags-sidebar ${
          drawerOpen ? "drawer-open" : ""
        }`}
      >
        <BookmarkPinnedTags
          tags={pinnedTags}
          selectedTagName={selectedTagName}
          addTagUrl={urls.addTag}
          removeTagUrl={urls.removeTag}
          sortTagsUrl={urls.sortPinnedTags}
          onTagsChange={setPinnedTags}
          onSearchTag={searchTag}
          onGetPage={getPage}
        />
      </div>

      <div className="col-lg-9 ps-gutter">
        <div>
          <div id="bookmark-search-form" className="d-flex flex-column me-2 p-3">
            <div>
              <div className="d-flex">
                {/* Tags/Filters button for mobile */}
                <button
                  type="button"
                  className="btn btn-primary bookmark-tags-drawer-toggle d-lg-none me-2"
                  onClick={toggleDrawer}
                  aria-label="Toggle Tags"
                >
                  <FontAwesomeIcon icon={faTags} className="me-2" />
                  Tags
                </button>
                <form
                  className="form-inline"
                  role="form"
                  method="get"
                  onSubmit={e => e.preventDefault()}
                >
                  <input
                    type="hidden"
                    name="csrfmiddlewaretoken"
                    value={(window as any).BASE_TEMPLATE_DATA?.csrfToken || ""}
                  />
                  <input value={selectedTagName || ""} type="hidden" name="tag" />
                  <div className="position-relative">
                    <SelectValue
                      ref={selectValueRef}
                      id="bookmarkSearch"
                      searchUrl={`${urls.getTagsUsedByBookmarks}?query=`}
                      placeHolder="Filter by keyword or tag"
                      searchIcon={true}
                      onSelect={selectTag}
                      onSearch={handleSearch}
                    />
                  </div>
                </form>
                <div className="btn-group ms-3" role="group" aria-label="List View">
                  <button
                    type="button"
                    className={`btn btn-primary ${viewType === "normal" ? "active" : ""}`}
                    onClick={() => switchViewType("normal")}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    className={`btn btn-primary ${viewType === "compact" ? "active" : ""}`}
                    onClick={() => switchViewType("compact")}
                  >
                    Compact
                  </button>
                </div>
                {tagIsSelected && (
                  <div className="tag d-flex align-items-center bookmark-selected-tag-chip">
                    {selectedTagName}
                    <a
                      className="ms-2"
                      href="#"
                      onClick={e => {
                        e.preventDefault();
                        removeFilter();
                      }}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </a>
                  </div>
                )}
                <div className="ms-auto">
                  <DropDownMenu
                    dropdownSlot={
                      <ul className="dropdown-menu-list">
                        {tagIsSelected && (
                          <li>
                            <a
                              className="dropdown-item"
                              href="#"
                              onClick={e => {
                                e.preventDefault();
                                handleTogglePinStatus();
                              }}
                            >
                              <FontAwesomeIcon icon={faThumbTack} className="text-primary me-3" />
                              {isPinned ? "Unpin" : "Pin"}
                            </a>
                          </li>
                        )}
                        <li>
                          <a className="dropdown-item" href={urls.bookmarkCreate}>
                            <FontAwesomeIcon icon={faPlus} className="text-primary me-3" />
                            New Bookmark
                          </a>
                        </li>
                      </ul>
                    }
                  />
                </div>
              </div>
            </div>
            {searchTerm && (
              <div className="d-flex mt-1 ms-3">
                <div
                  id="bookmark-search-filter"
                  className="tag label label-info d-flex align-items-center"
                >
                  <div>
                    Term: <span className="text-white">{searchTerm}</span>
                  </div>
                  <div>
                    <a
                      className="ms-1"
                      href="#"
                      onClick={e => {
                        e.preventDefault();
                        removeFilter();
                      }}
                    >
                      <FontAwesomeIcon icon={faTimes} className="text-primary" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card-grid h-100 ps-0 mt-2">
          <BookmarkList
            bookmarks={bookmarkList}
            viewType={viewType}
            selectedTagName={selectedTagName}
            selectedBookmarkUuid={selectedBookmarkUuid}
            sortUrl={urls.bookmarkSort}
            editBookmarkUrl={urls.bookmarkUpdate}
            onBookmarksChange={setBookmarkList}
            onClickBookmark={handleClickBookmark}
            onEditBookmark={handleEditBookmark}
            onDeleteBookmark={handleDeleteBookmark}
            onClickTag={searchTag}
          />

          <BookmarkPagination pagination={pagination} onGetPage={getPage} />
        </div>
      </div>
    </div>
  );
}

export default BookmarkListPage;
