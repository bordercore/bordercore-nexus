import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import FeedSidebar from "./FeedSidebar";
import ItemList from "./ItemList";
import ItemReader from "./ItemReader";
import FeedEditorModal from "./FeedEditorModal";
import { doDelete, doPost } from "../utils/reactUtils";
import type { Feed, FeedEditorData, FeedItem } from "./types";

interface TriplePaneFeedPageProps {
  initialFeedList: Feed[];
  initialCurrentFeed: Feed | null;
  storeInSessionUrl: string;
  editFeedUrl: string;
  newFeedUrl: string;
  feedCheckUrl: string;
}

export function TriplePaneFeedPage({
  initialFeedList,
  initialCurrentFeed,
  storeInSessionUrl,
  editFeedUrl,
  newFeedUrl,
  feedCheckUrl,
}: TriplePaneFeedPageProps) {
  const [feedList, setFeedList] = useState<Feed[]>(initialFeedList);
  const [activeFeedId, setActiveFeedId] = useState<number | null>(initialCurrentFeed?.id ?? null);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);

  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editorAction, setEditorAction] = useState<"Edit" | "Create">("Create");
  const [editorFeedInfo, setEditorFeedInfo] = useState<FeedEditorData>({
    name: "",
    url: "",
    homepage: "",
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!deleteModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteModalOpen(false);
    };
    window.addEventListener("keydown", handler);
    const t = window.setTimeout(() => deleteCancelRef.current?.focus(), 40);
    return () => {
      window.removeEventListener("keydown", handler);
      window.clearTimeout(t);
    };
  }, [deleteModalOpen]);

  const activeFeed = useMemo(
    () => feedList.find(f => f.id === activeFeedId) ?? null,
    [feedList, activeFeedId]
  );
  const activeItem = useMemo(
    () => activeFeed?.feedItems.find(i => i.id === activeItemId) ?? null,
    [activeFeed, activeItemId]
  );

  const handleSelectFeed = useCallback(
    (feedId: number) => {
      setActiveFeedId(feedId);
      setActiveItemId(null);
      if (storeInSessionUrl) {
        doPost(storeInSessionUrl, { key: "current_feed", value: feedId }, () => {});
      }
    },
    [storeInSessionUrl]
  );

  const handleSelectItem = useCallback((itemId: number) => {
    setActiveItemId(itemId);
  }, []);

  const updateItem = useCallback((itemId: number, patch: Partial<FeedItem>) => {
    setFeedList(prev =>
      prev.map(feed => ({
        ...feed,
        feedItems: feed.feedItems.map(item => (item.id === itemId ? { ...item, ...patch } : item)),
      }))
    );
  }, []);

  const markFeedItemsRead = useCallback((feedId: number) => {
    const now = new Date().toISOString();
    setFeedList(prev =>
      prev.map(feed => {
        if (feed.id !== feedId) return feed;
        return {
          ...feed,
          feedItems: feed.feedItems.map(item =>
            item.readAt === null ? { ...item, readAt: now } : item
          ),
        };
      })
    );
  }, []);

  const handleNewFeed = useCallback(() => {
    setEditorAction("Create");
    setEditorFeedInfo({ name: "", url: "", homepage: "" });
    setEditorModalOpen(true);
  }, []);

  const handleEditFeed = useCallback(() => {
    if (!activeFeed) return;
    setEditorAction("Edit");
    setEditorFeedInfo({
      uuid: activeFeed.uuid,
      name: activeFeed.name,
      url: activeFeed.url,
      homepage: activeFeed.homepage || "",
    });
    setEditorModalOpen(true);
  }, [activeFeed]);

  const handleEditorClose = useCallback(() => setEditorModalOpen(false), []);

  const handleFeedAdd = useCallback((newFeed: Feed) => {
    setFeedList(prev => [{ ...newFeed, feedItems: newFeed.feedItems ?? [] }, ...prev]);
  }, []);

  const handleDeleteFeedClick = useCallback(() => {
    setDeleteModalOpen(true);
  }, []);

  const handleDeleteFeedClose = useCallback(() => {
    if (deleteSubmitting) return;
    setDeleteModalOpen(false);
  }, [deleteSubmitting]);

  const handleDeleteFeedConfirm = useCallback(() => {
    if (!activeFeed || deleteSubmitting) return;
    const deleteUrl = editFeedUrl.replace(/00000000-0000-0000-0000-000000000000/, activeFeed.uuid);
    setDeleteSubmitting(true);
    doDelete(
      deleteUrl,
      () => {
        setFeedList(prev => {
          const next = prev.filter(f => f.uuid !== activeFeed.uuid);
          setActiveFeedId(next[0]?.id ?? null);
          setActiveItemId(null);
          return next;
        });
        setDeleteSubmitting(false);
        setDeleteModalOpen(false);
      },
      "Feed deleted"
    );
  }, [activeFeed, editFeedUrl, deleteSubmitting]);

  return (
    <div className="tp-feed-page">
      <FeedSidebar
        feedList={feedList}
        activeFeedId={activeFeedId}
        onSelectFeed={handleSelectFeed}
        onNewFeed={handleNewFeed}
      />
      <ItemList
        feed={activeFeed}
        activeItemId={activeItemId}
        onSelectItem={handleSelectItem}
        onMarkAllRead={markFeedItemsRead}
        onEditFeed={handleEditFeed}
        onDeleteFeed={handleDeleteFeedClick}
      />
      <ItemReader feed={activeFeed} item={activeItem} onMarkRead={updateItem} />

      {deleteModalOpen &&
        createPortal(
          <>
            <div className="refined-modal-scrim" onClick={handleDeleteFeedClose} />
            <div
              className="refined-modal rm-confirm-modal"
              role="dialog"
              aria-label="confirm delete feed"
            >
              <button
                type="button"
                className="refined-modal-close"
                onClick={handleDeleteFeedClose}
                aria-label="close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>

              <h2 className="refined-modal-title">Delete this feed?</h2>
              <p className="refined-modal-lead">
                {activeFeed ? (
                  <>
                    <code className="rm-confirm-name">{activeFeed.name}</code> will be removed. This
                    cannot be undone.
                  </>
                ) : (
                  <>This feed will be removed. This cannot be undone.</>
                )}
              </p>

              <div className="refined-modal-actions">
                <button
                  ref={deleteCancelRef}
                  type="button"
                  className="refined-btn ghost"
                  onClick={handleDeleteFeedClose}
                >
                  cancel
                </button>
                <button
                  type="button"
                  className="refined-btn danger"
                  onClick={handleDeleteFeedConfirm}
                  disabled={deleteSubmitting || !activeFeed}
                >
                  <FontAwesomeIcon icon={faTrashAlt} className="refined-btn-icon" />
                  {deleteSubmitting ? "deleting…" : "delete feed"}
                </button>
              </div>
            </div>
          </>,
          document.body
        )}

      <FeedEditorModal
        isOpen={editorModalOpen}
        action={editorAction}
        feedInfo={editorFeedInfo}
        editFeedUrl={editFeedUrl}
        newFeedUrl={newFeedUrl}
        feedCheckUrl={feedCheckUrl}
        onAddFeed={handleFeedAdd}
        onClose={handleEditorClose}
      />
    </div>
  );
}

export default TriplePaneFeedPage;
