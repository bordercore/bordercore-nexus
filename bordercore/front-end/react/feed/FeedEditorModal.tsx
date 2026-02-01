import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import { Modal } from "bootstrap";
import { doGet, doPut, doPost } from "../utils/reactUtils";
import type { Feed, FeedEditorData } from "./types";

interface StatusMessage {
  type: "ok" | "error" | "empty" | null;
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
  const [feedInfo, setFeedInfo] = useState<FeedEditorData>(initialFeedInfo);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>({ type: null });
  const [lastResponseCode, setLastResponseCode] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalInstanceRef = useRef<Modal | null>(null);

  // Reset form when modal opens with new data
  useEffect(() => {
    setFeedInfo(initialFeedInfo);
    setStatusMessage({ type: null });
    setLastResponseCode(null);
  }, [initialFeedInfo]);

  // Handle modal visibility
  useEffect(() => {
    if (modalRef.current && !modalInstanceRef.current) {
      modalInstanceRef.current = new Modal(modalRef.current);
    }

    if (isOpen && modalInstanceRef.current) {
      modalInstanceRef.current.show();
    } else if (!isOpen && modalInstanceRef.current) {
      modalInstanceRef.current.hide();
    }
  }, [isOpen]);

  // Handle Bootstrap modal hidden event
  useEffect(() => {
    const modalElement = modalRef.current;
    if (!modalElement) return;

    const handleHidden = () => {
      onClose();
    };

    modalElement.addEventListener("hidden.bs.modal", handleHidden);
    return () => {
      modalElement.removeEventListener("hidden.bs.modal", handleHidden);
    };
  }, [onClose]);

  const statusIcon = useMemo(() => {
    if (statusMessage.type === null) {
      return {
        className: "d-none",
        icon: faCheck,
      };
    } else if (statusMessage.type === "ok") {
      return {
        className: "d-block text-success",
        icon: faCheck,
      };
    } else {
      return {
        className: "d-block text-danger",
        icon: faExclamationTriangle,
      };
    }
  }, [statusMessage.type]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFeedInfo(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleUrlBlur = useCallback(() => {
    const feedUrl = feedInfo.url;
    if (!feedUrl) {
      return;
    }

    setCheckingStatus(true);

    // Auto-populate homepage if not set
    if (!feedInfo.homepage) {
      const baseUrl = feedUrl.match(/^(https?:\/\/.*?)\//);
      if (baseUrl) {
        setFeedInfo(prev => ({ ...prev, homepage: baseUrl[1] }));
      }
    }

    const encodedUrl = encodeURIComponent(feedUrl).replace(/%/g, "%25");
    const checkUrl = feedCheckUrl.replace(/666/, encodedUrl);

    doGet(
      checkUrl,
      response => {
        setCheckingStatus(false);
        setLastResponseCode(response.data.status_code);
        if (!response || response.data.status_code !== StatusCodes.OK) {
          setStatusMessage({
            type: "error",
            text: getReasonPhrase(response.data.status),
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
  }, [feedInfo.url, feedInfo.homepage, feedCheckUrl]);

  const handleSubmit = useCallback(() => {
    if (action === "Edit" && feedInfo.uuid) {
      const url = editFeedUrl.replace(/00000000-0000-0000-0000-000000000000/, feedInfo.uuid);
      doPut(
        url,
        {
          feed_uuid: feedInfo.uuid,
          homepage: feedInfo.homepage,
          name: feedInfo.name,
          url: feedInfo.url,
        },
        () => {
          if (modalInstanceRef.current) {
            modalInstanceRef.current.hide();
          }
        },
        "Feed edited"
      );
    } else {
      doPost(
        newFeedUrl,
        {
          homepage: feedInfo.homepage,
          name: feedInfo.name,
          url: feedInfo.url,
        },
        response => {
          onAddFeed(response.data.feed_info);
          if (modalInstanceRef.current) {
            modalInstanceRef.current.hide();
          }
        },
        "Feed added. Please wait up to an hour for the feed to refresh."
      );
    }
  }, [action, feedInfo, editFeedUrl, newFeedUrl, onAddFeed]);

  const renderStatusMessage = () => {
    switch (statusMessage.type) {
      case "ok":
        return (
          <>
            Feed <strong>OK</strong>. Found <strong>{statusMessage.count}</strong> feed items.
          </>
        );
      case "error":
        return (
          <>
            Feed error. Status: <strong>{statusMessage.text}</strong>
          </>
        );
      case "empty":
        return <>Feed error. Found no feed items.</>;
      default:
        return null;
    }
  };

  return (
    <div
      ref={modalRef}
      id="modalEditFeed"
      className="modal fade"
      tabIndex={-1}
      role="dialog"
      aria-labelledby="myModalLabel"
    >
      <div className="modal-dialog modal-lg" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h4 id="myModalLabel" className="modal-title">
              {action} Feed
            </h4>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            />
          </div>
          <div className="modal-body">
            <form onSubmit={e => e.preventDefault()}>
              <div className="row mb-3">
                <label className="fw-bold col-lg-3 col-form-label text-end" htmlFor="id_name">
                  Name
                </label>
                <div className="col-lg-9">
                  <input
                    id="id_name"
                    type="text"
                    name="name"
                    className="form-control"
                    autoComplete="off"
                    maxLength={200}
                    required
                    value={feedInfo.name}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="row mb-3">
                <label className="fw-bold col-lg-3 col-form-label text-end" htmlFor="id_url">
                  Url
                </label>
                <div className="col-lg-9">
                  <input
                    id="id_url"
                    type="text"
                    name="url"
                    className="form-control"
                    required
                    autoComplete="off"
                    value={feedInfo.url}
                    onChange={handleInputChange}
                    onBlur={handleUrlBlur}
                  />
                </div>
              </div>

              <div className="row mb-3">
                <label className="fw-bold col-lg-3 col-form-label text-end" htmlFor="id_homepage">
                  Homepage
                </label>
                <div className="col-lg-9">
                  <input
                    id="id_homepage"
                    type="text"
                    name="homepage"
                    className="form-control"
                    autoComplete="off"
                    maxLength={200}
                    required
                    value={feedInfo.homepage}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </form>
          </div>
          <div className="modal-footer row g-0">
            <div className="col-offset-3 col-lg-9 d-flex align-items-center ps-3">
              <div id="feed-status">
                <div className="d-flex align-items-center">
                  {checkingStatus ? (
                    <div className="d-flex align-items-center">
                      <div className="spinner-border ms-2 text-secondary" role="status">
                        <span className="sr-only">Checking feed status...</span>
                      </div>
                      <div className="ms-3">Checking feed status...</div>
                    </div>
                  ) : (
                    <>
                      <FontAwesomeIcon
                        className={`me-2 ${statusIcon.className}`}
                        icon={statusIcon.icon}
                      />
                      <div>{renderStatusMessage()}</div>
                    </>
                  )}
                </div>
              </div>
              <input
                className="btn btn-primary ms-auto"
                type="submit"
                value="Save"
                onClick={handleSubmit}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeedEditorModal;
