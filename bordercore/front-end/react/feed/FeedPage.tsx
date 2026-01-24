import React, { useState, useCallback, useRef, useEffect } from "react";
import { Modal } from "bootstrap";
import FeedInfo from "./FeedInfo";
import FeedList from "./FeedList";
import FeedItemList from "./FeedItemList";
import FeedEditorModal from "./FeedEditorModal";
import { doDelete } from "../utils/reactUtils";
import type { Feed, FeedEditorData } from "./types";

interface FeedPageProps {
  initialFeedList: Feed[];
  initialCurrentFeed: Feed | null;
  feedSortUrl: string;
  storeInSessionUrl: string;
  editFeedUrl: string;
  newFeedUrl: string;
  feedCheckUrl: string;
}

export function FeedPage({
  initialFeedList,
  initialCurrentFeed,
  feedSortUrl,
  storeInSessionUrl,
  editFeedUrl,
  newFeedUrl,
  feedCheckUrl,
}: FeedPageProps) {
  const [feedList, setFeedList] = useState<Feed[]>(initialFeedList);
  const [currentFeed, setCurrentFeed] = useState<Feed | null>(initialCurrentFeed);

  // Modal state
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editorAction, setEditorAction] = useState<"Edit" | "Create">("Create");
  const [editorFeedInfo, setEditorFeedInfo] = useState<FeedEditorData>({
    name: "",
    url: "",
    homepage: "",
  });

  const deleteModalRef = useRef<HTMLDivElement>(null);
  const deleteModalInstanceRef = useRef<Modal | null>(null);

  // Initialize delete modal
  useEffect(() => {
    if (deleteModalRef.current && !deleteModalInstanceRef.current) {
      deleteModalInstanceRef.current = new Modal(deleteModalRef.current);
    }
  }, []);

  const showFeed = useCallback((feed: Feed) => {
    setCurrentFeed(feed);
  }, []);

  const handleNewFeed = useCallback(() => {
    setEditorAction("Create");
    setEditorFeedInfo({ name: "", url: "", homepage: "" });
    setEditorModalOpen(true);
  }, []);

  const handleOpenModal = useCallback(
    (action: "Edit" | "Create", feedInfo: Feed | null) => {
      setEditorAction(action);
      if (feedInfo) {
        setEditorFeedInfo({
          uuid: feedInfo.uuid,
          name: feedInfo.name,
          url: feedInfo.url,
          homepage: feedInfo.homepage || "",
        });
      } else {
        setEditorFeedInfo({ name: "", url: "", homepage: "" });
      }
      setEditorModalOpen(true);
    },
    []
  );

  const handleEditorClose = useCallback(() => {
    setEditorModalOpen(false);
  }, []);

  const handleFeedAdd = useCallback((newFeed: Feed) => {
    setFeedList((prev) => [newFeed, ...prev]);
  }, []);

  const handleReorder = useCallback((reorderedList: Feed[]) => {
    setFeedList(reorderedList);
  }, []);

  const handleDeleteFeedClick = useCallback(() => {
    if (deleteModalInstanceRef.current) {
      deleteModalInstanceRef.current.show();
    }
  }, []);

  const handleDeleteFeedConfirm = useCallback(() => {
    if (!currentFeed) return;

    const deleteUrl = editFeedUrl.replace(
      /00000000-0000-0000-0000-000000000000/,
      currentFeed.uuid
    );

    doDelete(deleteUrl, () => {
      // Remove from list
      setFeedList((prev) => prev.filter((f) => f.uuid !== currentFeed.uuid));

      // Select first remaining feed
      setFeedList((prev) => {
        if (prev.length > 0) {
          setCurrentFeed(prev[0]);
        } else {
          setCurrentFeed(null);
        }
        return prev;
      });

      // Hide modal
      if (deleteModalInstanceRef.current) {
        deleteModalInstanceRef.current.hide();
      }
    }, "Feed deleted");
  }, [currentFeed, editFeedUrl]);

  return (
    <div className="row g-0 mx-2">
      <div className="col-lg-3 d-flex flex-column flex-grow-last pe-gutter">
        <FeedInfo currentFeed={currentFeed} onNewFeed={handleNewFeed} />
      </div>

      <div className="col-lg-3 d-flex flex-column pe-gutter">
        <div className="card">
          <div className="card-body backdrop-filter">
            <div className="d-flex">
              <h3>Feed List</h3>
            </div>
            <hr />
            <FeedList
              feedList={feedList}
              currentFeed={currentFeed}
              feedSortUrl={feedSortUrl}
              storeInSessionUrl={storeInSessionUrl}
              onShowFeed={showFeed}
              onEditFeed={handleNewFeed}
              onReorder={handleReorder}
            />
          </div>
        </div>
      </div>

      <div className="col-lg-6 d-flex flex-column flex-grow-last">
        <FeedItemList
          currentFeed={currentFeed}
          onOpenModal={handleOpenModal}
          onDeleteFeed={handleDeleteFeedClick}
        />
      </div>

      {/* Delete Confirmation Modal */}
      <div
        ref={deleteModalRef}
        id="modalDeleteFeed"
        className="modal fade"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="myModalLabel"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 id="myModalLabel" className="modal-title">
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
                  id="btn-action"
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
      </div>

      {/* Feed Editor Modal */}
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

export default FeedPage;
