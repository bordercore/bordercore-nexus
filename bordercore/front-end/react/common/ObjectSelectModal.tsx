import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart, faStickyNote, faTimes } from "@fortawesome/free-solid-svg-icons";
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
  open: boolean;
  onClose: () => void;
  title?: string;
  searchObjectUrl: string;
  onSelectObject?: (object: ObjectOption) => void;
}

// Note: dangerouslySetInnerHTML is used below for boldenOption which safely wraps
// matching search text in <strong> tags. The content is the user's own data.
export function ObjectSelectModal({
  open,
  onClose,
  title = "Select object",
  searchObjectUrl,
  onSelectObject,
}: ObjectSelectModalProps) {
  const [doctypes] = useState(["blob", "book", "bookmark", "document", "note"]);
  const [, setOptions] = useState<ObjectOption[]>([]);

  const selectValueRef = useRef<SelectValueHandle>(null);

  const getSearchUrl = useCallback(() => {
    let url = searchObjectUrl;
    url += "?doc_type=" + doctypes.join(",");
    url += "&term=";
    return url;
  }, [searchObjectUrl, doctypes]);

  // Load recent blobs and bookmarks from page data each time the modal opens.
  useEffect(() => {
    if (!open) return;

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

    // Auto-focus the search input shortly after mount so the entrance
    // animation doesn't fight with focus.
    const t = window.setTimeout(() => selectValueRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  // Escape-to-close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleObjectSelect = useCallback(
    (selection: ObjectOption) => {
      if (selection.splitter) return;
      onSelectObject?.(selection);
      onClose();
    },
    [onSelectObject, onClose]
  );

  const renderOption = useCallback(
    ({ option, search }: { option: ObjectOption; search: string }) => {
      if (option.splitter) {
        return <div className="search-splitter">{option.name}</div>;
      }

      return (
        <div
          className="object-select-suggestion d-flex dropdown-item cursor-pointer"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            handleObjectSelect(option);
          }}
        >
          {option.cover_url && (
            <div className="cover-image me-2">
              <img
                className="mh-100 mw-100 object-select-cover-image"
                src={option.cover_url}
                alt=""
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
              <img width="120" height="67" src={option.thumbnail_url} alt="" />
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

  if (!open) return null;

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <div className="refined-modal" role="dialog" aria-label={title}>
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">{title}</h2>

        <div className="refined-field">
          <SelectValue
            ref={selectValueRef}
            searchUrl={getSearchUrl()}
            placeHolder="Search"
            onSelect={handleObjectSelect}
            optionSlot={renderOption}
          />
        </div>
      </div>
    </>,
    document.body
  );
}

export default ObjectSelectModal;
