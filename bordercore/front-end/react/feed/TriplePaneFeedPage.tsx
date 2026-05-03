import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "bootstrap";
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

  const deleteModalRef = useRef<HTMLDivElement>(null);
  const deleteModalInstanceRef = useRef<Modal | null>(null);

  useEffect(() => {
    if (deleteModalRef.current && !deleteModalInstanceRef.current) {
      deleteModalInstanceRef.current = new Modal(deleteModalRef.current);
    }
  }, []);

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
    deleteModalInstanceRef.current?.show();
  }, []);

  const handleDeleteFeedConfirm = useCallback(() => {
    if (!activeFeed) return;
    const deleteUrl = editFeedUrl.replace(/00000000-0000-0000-0000-000000000000/, activeFeed.uuid);
    doDelete(
      deleteUrl,
      () => {
        setFeedList(prev => {
          const next = prev.filter(f => f.uuid !== activeFeed.uuid);
          setActiveFeedId(next[0]?.id ?? null);
          setActiveItemId(null);
          return next;
        });
        deleteModalInstanceRef.current?.hide();
      },
      "Feed deleted"
    );
  }, [activeFeed, editFeedUrl]);

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

      {createPortal(
        <div
          ref={deleteModalRef}
          id="modalDeleteFeed"
          className="modal fade"
          tabIndex={-1}
          role="dialog"
          aria-labelledby="deleteFeedLabel"
        >
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h4 id="deleteFeedLabel" className="modal-title">
                  Delete Feed
                </h4>
                <button
                  type="button"
                  className="btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                <div>Are you sure you want to delete this feed?</div>
                <div className="mt-3">
                  <input
                    className="btn btn-primary"
                    type="button"
                    value="Confirm"
                    onClick={handleDeleteFeedConfirm}
                  />
                  <a href="#" data-bs-dismiss="modal" className="ms-3">
                    Cancel
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>,
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
