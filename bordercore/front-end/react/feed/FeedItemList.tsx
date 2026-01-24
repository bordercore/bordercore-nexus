import React, { useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import DropDownMenu from "../common/DropDownMenu";
import type { Feed } from "./types";

interface FeedItemListProps {
  currentFeed: Feed | null;
  onOpenModal: (action: "Edit" | "Create", feedInfo: Feed | null) => void;
  onDeleteFeed: () => void;
}

export function FeedItemList({
  currentFeed,
  onOpenModal,
  onDeleteFeed,
}: FeedItemListProps) {
  const feedDetailMenuItems = useMemo(
    () => [
      {
        id: uuidv4(),
        title: "Edit Feed",
        url: "#",
        clickHandler: () => onOpenModal("Edit", currentFeed),
        icon: "pencil-alt",
      },
      {
        id: uuidv4(),
        title: "Delete Feed",
        url: "#",
        clickHandler: onDeleteFeed,
        icon: "times",
      },
    ],
    [currentFeed, onOpenModal, onDeleteFeed]
  );

  if (!currentFeed) {
    return (
      <div className="card">
        <div className="card-body backdrop-filter h-100 me-2">
          <div className="text-secondary">Select a feed to view its items.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-body backdrop-filter h-100 me-2">
        <div className="d-flex">
          <h3 id="feed-title">
            <a href={currentFeed.homepage || "#"}>{currentFeed.name}</a>
          </h3>
          <div className="ms-auto">
            <DropDownMenu links={feedDetailMenuItems} />
          </div>
        </div>
        <hr />
        <ul>
          {currentFeed.feedItems.map((item) => (
            <li key={item.id}>
              <a href={item.link}>{item.title}</a>
            </li>
          ))}
          {currentFeed.feedItems.length === 0 && (
            <div>No feed items found.</div>
          )}
        </ul>
      </div>
    </div>
  );
}

export default FeedItemList;
