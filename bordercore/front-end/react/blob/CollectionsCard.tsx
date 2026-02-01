import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faObjectGroup, faPlus, faStickyNote } from "@fortawesome/free-solid-svg-icons";
import { Card } from "../common/Card";
import { DropDownMenu } from "../common/DropDownMenu";
import { Popover } from "../common/Popover";
import type { Collection } from "./types";

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

interface CollectionsCardProps {
  collections: Collection[];
  onAddToCollection?: () => void;
}

export function CollectionsCard({ collections, onAddToCollection }: CollectionsCardProps) {
  if (collections.length === 0) {
    return null;
  }

  const dropdownItems = (
    <ul className="dropdown-menu-list">
      <li>
        <a
          className="dropdown-item"
          href="#"
          onClick={e => {
            e.preventDefault();
            onAddToCollection?.();
          }}
        >
          <FontAwesomeIcon icon={faPlus} className="text-primary me-3" />
          Add to Collection
        </a>
      </li>
    </ul>
  );

  const titleSlot = (
    <div className="d-flex w-100">
      <div className="card-title d-flex flex-grow-1">
        <FontAwesomeIcon icon={faObjectGroup} className="text-primary me-3 mt-1" />
        Collections
      </div>
      <div className="dropdown-menu-container collections-dropdown ms-auto">
        <DropDownMenu showOnHover={true} dropdownSlot={dropdownItems} />
      </div>
    </div>
  );

  return (
    <Card cardClassName="backdrop-filter hover-reveal-target" titleSlot={titleSlot}>
      {collections.map(collection => (
        <div key={collection.uuid} className="d-flex flex-column">
          <hr className="divider" />
          <div className="d-flex flex-column align-items-center">
            <a href={collection.url}>
              <img src={collection.coverUrl} className="mw-100" alt="" />
            </a>
          </div>
          <div className="d-flex flex-column align-items-center position-relative mt-2 mb-2">
            {collection.note && (
              <Popover
                trigger={
                  <div className="blob-collection-note cursor-pointer">
                    <FontAwesomeIcon icon={faStickyNote} />
                  </div>
                }
                placement="top"
              >
                {/* User's own collection note from database - safe to render */}
                <div dangerouslySetInnerHTML={{ __html: collection.note }} />
              </Popover>
            )}
            <h5 className="text5 mb-0">{collection.name}</h5>
            <div className="fw-bold me-1">
              <strong className="me-1">{collection.numObjects}</strong>{" "}
              {pluralize("Object", collection.numObjects)}
            </div>
          </div>
        </div>
      ))}
    </Card>
  );
}

export default CollectionsCard;
