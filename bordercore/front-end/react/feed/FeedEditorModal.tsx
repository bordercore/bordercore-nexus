import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faExclamationTriangle, faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { doGet, doPut, doPost } from "../utils/reactUtils";
import type { Feed, FeedEditorData } from "./types";

type StatusType = "ok" | "error" | "empty" | null;

interface StatusMessage {
  type: StatusType;
  text?: string;
  count?: number;
}

interface FeedEditorModalProps {
  isOpen: boolean;
  action: "Edit" | "Create";
  feedInfo: FeedEditorData;
  editFeedUrl: string;
  newFeedUrl: string;
  feedCheckUrl: string;
  onAddFeed: (feedInfo: Feed) => void;
  onClose: () => void;
}

const PLACEHOLDER_UUID = "00000000-0000-0000-0000-000000000000";

export function FeedEditorModal({
  isOpen,
  action,
  feedInfo: initialFeedInfo,
  editFeedUrl,
  newFeedUrl,
  feedCheckUrl,
  onAddFeed,
  onClose,
}: FeedEditorModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [homepage, setHomepage] = useState("");
  const [uuid, setUuid] = useState<string | undefined>(undefined);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>({ type: null });

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(initialFeedInfo.name ?? "");
    setUrl(initialFeedInfo.url ?? "");
    setHomepage(initialFeedInfo.homepage ?? "");
    setUuid(initialFeedInfo.uuid);
    setCheckingStatus(false);
    setStatusMessage({ type: null });
    const t = window.setTimeout(() => nameRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [isOpen, initialFeedInfo]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleUrlBlur = useCallback(() => {
    if (!url) return;

    setCheckingStatus(true);

    if (!homepage) {
      const baseUrl = url.match(/^(https?:\/\/.*?)\//);
      if (baseUrl) {
        setHomepage(baseUrl[1]);
      }
    }

    const encodedUrl = encodeURIComponent(url).replace(/%/g, "%25");
    const checkUrl = feedCheckUrl.replace(/666/, encodedUrl);

    doGet(
      checkUrl,
      response => {
        setCheckingStatus(false);
        if (!response || response.data.status_code !== StatusCodes.OK) {
          setStatusMessage({
            type: "error",
            text: getReasonPhrase(response.data.status_code),
          });
        } else if (response.data.entry_count === 0) {
          setStatusMessage({ type: "empty" });
        } else {
          setStatusMessage({
            type: "ok",
            count: response.data.entry_count,
          });
        }
      },
      "Error getting feed info"
    );
  }, [url, homepage, feedCheckUrl]);

  const canSubmit = name.trim().length > 0 && url.trim().length > 0 && !checkingStatus;

  const submit = useCallback(() => {
    if (!canSubmit) return;
    if (action === "Edit" && uuid) {
      const target = editFeedUrl.replace(PLACEHOLDER_UUID, uuid);
      doPut(target, { feed_uuid: uuid, homepage, name, url }, () => onClose(), "Feed edited");
    } else {
      doPost(
        newFeedUrl,
        { homepage, name, url },
        response => {
          onAddFeed(response.data.feed_info);
          onClose();
        },
        "Feed added. Please wait up to an hour for the feed to refresh."
      );
    }
  }, [action, canSubmit, uuid, editFeedUrl, newFeedUrl, name, url, homepage, onAddFeed, onClose]);

  const status = useMemo(() => {
    if (checkingStatus) {
      return (
        <div className="feed-status checking">
          <span
            className="spinner-border spinner-border-sm feed-status-spinner"
            role="status"
            aria-hidden="true"
          />
          <span>checking feed status…</span>
        </div>
      );
    }
    switch (statusMessage.type) {
      case "ok":
        return (
          <div className="feed-status ok">
            <FontAwesomeIcon icon={faCheck} className="feed-status-icon" />
            <span>
              feed ok · <strong>{statusMessage.count}</strong> items
            </span>
          </div>
        );
      case "error":
        return (
          <div className="feed-status error">
            <FontAwesomeIcon icon={faExclamationTriangle} className="feed-status-icon" />
            <span>
              feed error · <strong>{statusMessage.text}</strong>
            </span>
          </div>
        );
      case "empty":
        return (
          <div className="feed-status error">
            <FontAwesomeIcon icon={faExclamationTriangle} className="feed-status-icon" />
            <span>feed error · no items found</span>
          </div>
        );
      default:
        return null;
    }
  }, [checkingStatus, statusMessage]);

  if (!isOpen) return null;

  const isEdit = action === "Edit";
  const titleText = isEdit ? "Edit feed" : "Create a feed";

  return createPortal(
    <>
      <div className="refined-modal-scrim" onClick={onClose} />
      <form
        className="refined-modal"
        role="dialog"
        aria-label={isEdit ? "edit feed" : "create new feed"}
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className="refined-modal-close" onClick={onClose} aria-label="close">
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h2 className="refined-modal-title">{titleText}</h2>

        <div className="refined-field">
          <label htmlFor="feed-edit-name">name</label>
          <input
            ref={nameRef}
            id="feed-edit-name"
            type="text"
            autoComplete="off"
            maxLength={200}
            placeholder={isEdit ? undefined : "e.g. NYT World News"}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            required
          />
        </div>

        <div className="refined-field">
          <label htmlFor="feed-edit-url">url</label>
          <input
            id="feed-edit-url"
            type="text"
            autoComplete="off"
            placeholder={isEdit ? undefined : "https://example.com/feed.xml"}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onBlur={handleUrlBlur}
            required
          />
          {status}
        </div>

        <div className="refined-field">
          <label htmlFor="feed-edit-homepage">homepage</label>
          <input
            id="feed-edit-homepage"
            type="text"
            autoComplete="off"
            maxLength={200}
            value={homepage}
            onChange={e => setHomepage(e.target.value)}
            required
          />
        </div>

        <div className="refined-modal-actions">
          <button type="button" className="refined-btn ghost" onClick={onClose}>
            cancel
          </button>
          <button type="submit" className="refined-btn primary" disabled={!canSubmit}>
            {!isEdit && <FontAwesomeIcon icon={faPlus} className="refined-btn-icon" />}
            {isEdit ? "save" : "create feed"}
          </button>
        </div>
      </form>
    </>,
    document.body
  );
}

export default FeedEditorModal;
