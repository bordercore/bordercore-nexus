import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisH,
  faImages,
  faPencilAlt,
  faPlus,
  faShuffle,
  faTh,
  faThLarge,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import DropDownMenu from "../common/DropDownMenu";
import type { CollectionDetail } from "./types";

interface CurateHeaderProps {
  collection: CollectionDetail;
  filteredCount: number;
  columns: number;
  shuffled: boolean;
  onColumnsChange: (n: 3 | 4 | 5 | 6) => void;
  onShuffle: () => void;
  onEdit: () => void;
  onAdd: () => void;
  onSlideshow: () => void;
  onDelete: () => void;
}

export function CurateHeader({
  collection,
  filteredCount,
  columns,
  shuffled,
  onColumnsChange,
  onShuffle,
  onEdit,
  onAdd,
  onSlideshow,
  onDelete,
}: CurateHeaderProps) {
  const moreLinks = [
    {
      id: "slideshow",
      title: "Slide Show",
      url: "#",
      icon: faImages,
      clickHandler: onSlideshow,
    },
    {
      id: "delete",
      title: "Delete Collection",
      url: "#",
      icon: faTimes,
      clickHandler: onDelete,
    },
  ];

  return (
    <header className="cd-header">
      <div className="cd-header-left">
        <h1 className="cd-title">{collection.name}</h1>
        <div className="cd-count">
          {filteredCount} {filteredCount === 1 ? "object" : "objects"}
        </div>
        {collection.description && <p className="cd-desc">{collection.description}</p>}
      </div>

      <div className="cd-tools">
        <div className="cd-zoom" role="group" aria-label="Grid density">
          <FontAwesomeIcon icon={faThLarge} aria-hidden="true" />
          <input
            type="range"
            min={3}
            max={6}
            step={1}
            value={columns}
            onChange={e => onColumnsChange(Number(e.target.value) as 3 | 4 | 5 | 6)}
            aria-label="Grid columns"
          />
          <FontAwesomeIcon icon={faTh} aria-hidden="true" />
          <span className="cd-zoom-readout">{columns} cols</span>
        </div>

        <button
          type="button"
          className={shuffled ? "cd-btn ghost icon-only active" : "cd-btn ghost icon-only"}
          onClick={onShuffle}
          aria-label="Shuffle (preview)"
          aria-pressed={shuffled}
          title={shuffled ? "Click to clear shuffle" : "Shuffle (preview, not saved)"}
        >
          <FontAwesomeIcon icon={faShuffle} />
        </button>

        <button
          type="button"
          className="cd-btn ghost icon-only"
          onClick={onEdit}
          aria-label="Edit collection"
          title="Edit collection"
        >
          <FontAwesomeIcon icon={faPencilAlt} />
        </button>

        <button type="button" className="cd-btn primary" onClick={onAdd} title="Add new blob">
          <FontAwesomeIcon icon={faPlus} />
          <span>add</span>
        </button>

        <DropDownMenu
          direction="dropstart"
          showTarget={false}
          links={moreLinks}
          iconSlot={
            <span className="cd-btn ghost icon-only" aria-label="More actions">
              <FontAwesomeIcon icon={faEllipsisH} />
            </span>
          }
        />
      </div>
    </header>
  );
}

export default CurateHeader;
