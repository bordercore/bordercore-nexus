import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import Card from "../common/Card";
import type { Feed } from "./types";

interface FeedInfoProps {
  currentFeed: Feed | null;
  onNewFeed: () => void;
}

export function FeedInfo({ currentFeed, onNewFeed }: FeedInfoProps) {
  const status = useMemo(() => {
    if (currentFeed?.lastResponse === "OK") {
      return {
        className: "text-success",
        icon: faCheck,
      };
    } else {
      return {
        className: "text-danger",
        icon: faExclamationTriangle,
      };
    }
  }, [currentFeed?.lastResponse]);

  return (
    <div className="card">
      <Card
        className="backdrop-filter"
        titleSlot={
          <>
            <div className="d-flex">
              <h3>Feed Info</h3>
            </div>
            <hr />
          </>
        }
      >
        <div>
          <strong>Edited</strong>: {currentFeed?.lastCheck || "—"}
        </div>
        <div>
          <strong>Status</strong>:{" "}
          {currentFeed && (
            <FontAwesomeIcon className={`ms-1 ${status.className}`} icon={status.icon} />
          )}
        </div>
        <div className="mt-3">
          <button className="btn btn-primary" onClick={onNewFeed}>
            New Feed
          </button>
        </div>
      </Card>
    </div>
  );
}

export default FeedInfo;
