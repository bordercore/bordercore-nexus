import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart, faStickyNote } from "@fortawesome/free-solid-svg-icons";
import SelectValue, { SelectValueHandle } from "./SelectValue";
import { boldenOption } from "../../util.js";

interface ObjectOption {
  uuid: string;
  name: string;
  url?: string;
  cover_url?: string;
  thumbnail_url?: string;
  doctype?: string;
  date?: string;
  important?: number;
  splitter?: boolean;
}

interface ObjectSelectModalProps {
  id?: string;
  title?: string;
  searchObjectUrl: string;
  onSelectObject?: (object: ObjectOption) => void;
}

export interface ObjectSelectModalHandle {
  open: (callback?: (object: ObjectOption) => void) => void;
  close: () => void;
}

// Note: dangerouslySetInnerHTML is used below for boldenOption which safely wraps
// matching search text in <strong> tags. The content is the user's own data.
export const ObjectSelectModal = React.forwardRef<ObjectSelectModalHandle, ObjectSelectModalProps>(
  function ObjectSelectModal(
    { id = "modalObjectSelect", title = "Select Object", searchObjectUrl, onSelectObject },
    ref
  ) {
    const [doctypes] = useState(["blob", "book", "bookmark", "document", "note"]);
    const [options, setOptions] = useState<ObjectOption[]>([]);

    const modalRef = useRef<HTMLDivElement>(null);
    const modalInstanceRef = useRef<Modal | null>(null);
    const selectValueRef = useRef<SelectValueHandle>(null);
    const onSelectCallbackRef = useRef<((object: ObjectOption) => void) | null>(null);

    useEffect(() => {
      if (modalRef.current && !modalInstanceRef.current) {
        modalInstanceRef.current = new Modal(modalRef.current);
      }
    }, []);

    const getSearchUrl = useCallback(() => {
      let url = searchObjectUrl;
      url += "?doc_type=" + doctypes.join(",");
      url += "&term=";
      return url;
    }, [searchObjectUrl, doctypes]);

    const loadInitialOptions = useCallback(() => {
      // Load recent blobs and bookmarks from page data
      const recentBlobsEl = document.getElementById("recent_blobs");
      const recentBookmarksEl = document.getElementById("recent-bookmarks");

      const initialOptions: ObjectOption[] = [];

      if (recentBlobsEl) {
        try {
          const recentBlobs = JSON.parse(recentBlobsEl.textContent || "{}");
          if (recentBlobs.blobList && recentBlobs.blobList.length > 0) {
            initialOptions.push({
              uuid: "__Recent_Blobs",
              name: "Recent Blobs",
              splitter: true,
            });
            initialOptions.push(...recentBlobs.blobList.slice(0, 5));
          }
        } catch (e) {
          console.error("Error parsing recent blobs:", e);
        }
      }

      if (recentBookmarksEl) {
        try {
          const recentBookmarks = JSON.parse(recentBookmarksEl.textContent || "{}");
          if (recentBookmarks.bookmarkList && recentBookmarks.bookmarkList.length > 0) {
            initialOptions.push({
              uuid: "__Recent_Bookmarks",
              name: "Recent Bookmarks",
              splitter: true,
            });
            initialOptions.push(...recentBookmarks.bookmarkList.slice(0, 5));
          }
        } catch (e) {
          console.error("Error parsing recent bookmarks:", e);
        }
      }

      setOptions(initialOptions);
    }, []);

    const openModal = useCallback((callback?: (object: ObjectOption) => void) => {
      onSelectCallbackRef.current = callback || null;
      if (modalInstanceRef.current) {
        modalInstanceRef.current.show();
        loadInitialOptions();
        setTimeout(() => {
          selectValueRef.current?.focus();
        }, 500);
      }
    }, [loadInitialOptions]);

    const closeModal = useCallback(() => {
      // Blur focused element before hiding to avoid aria-hidden accessibility warning
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      if (modalInstanceRef.current) {
        modalInstanceRef.current.hide();
      }
    }, []);

    React.useImperativeHandle(ref, () => ({
      open: openModal,
      close: closeModal,
    }));

    const handleObjectSelect = useCallback(
      (selection: ObjectOption) => {
        if (selection.splitter) return;

        // Use callback from open() if provided, otherwise use prop
        if (onSelectCallbackRef.current) {
          onSelectCallbackRef.current(selection);
        } else if (onSelectObject) {
          onSelectObject(selection);
        }
        closeModal();
      },
      [onSelectObject, closeModal]
    );

    const renderOption = useCallback(
      ({ option, search }: { option: ObjectOption; search: string }) => {
        if (option.splitter) {
          return <div className="search-splitter">{option.name}</div>;
        }

        return (
          <div
            className="object-select-suggestion d-flex dropdown-item cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleObjectSelect(option);
            }}
          >
            {option.cover_url && (
              <div className="cover-image me-2">
                <img
                  className="mh-100 mw-100"
                  src={option.cover_url}
                  alt=""
                  className="object-select-cover-image"
                />
              </div>
            )}
            {!option.cover_url && option.doctype === "Note" && (
              <div className="cover-image me-2">
                <FontAwesomeIcon icon={faStickyNote} className="fa-3x text-secondary" />
              </div>
            )}
            {!option.cover_url && option.doctype === "Bookmark" && option.thumbnail_url && (
              <div className="cover-image me-2">
                <img
                  width="120"
                  height="67"
                  src={option.thumbnail_url}
                  alt=""
                />
              </div>
            )}
            <div className="name d-flex flex-column">
              <div
                className="text-truncate"
                dangerouslySetInnerHTML={{ __html: boldenOption(option.name || "", search) }}
              />
              <div className="date text-muted small my-1">
                {option.date}
                {option.important === 10 && (
                  <span className="ms-2">
                    <FontAwesomeIcon icon={faHeart} className="text-danger" />
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
      [handleObjectSelect]
    );

    return (
      <div
        ref={modalRef}
        id={id}
        className="modal fade"
        tabIndex={-1}
        role="dialog"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">{title}</h4>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <div className="d-flex flex-column">
                <form onSubmit={(e) => e.preventDefault()}>
                  <SelectValue
                    ref={selectValueRef}
                    searchUrl={getSearchUrl()}
                    placeHolder="Search"
                    onSelect={handleObjectSelect}
                    optionSlot={renderOption}
                  />
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default ObjectSelectModal;
