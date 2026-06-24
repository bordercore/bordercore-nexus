import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimesCircle,
  faEllipsisV,
  faPencilAlt,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import Card from "../common/Card";
import DropDownMenu from "../common/DropDownMenu";
import SelectValue, { SelectValueHandle } from "../common/SelectValue";
import { doGet, doPost } from "../utils/reactUtils";

interface MutedTag {
  name: string;
  url: string;
  progress: number;
  count: number;
  last_reviewed: string;
}

interface DrillMutedTagsProps {
  getMutedTagsUrl: string;
  muteTagUrl: string;
  unmuteTagUrl: string;
  tagSearchUrl: string;
}

export function DrillMutedTags({
  getMutedTagsUrl,
  muteTagUrl,
  unmuteTagUrl,
  tagSearchUrl,
}: DrillMutedTagsProps) {
  const [dataLoading, setDataLoading] = useState(true);
  const [tagList, setTagList] = useState<MutedTag[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectValueRef = useRef<SelectValueHandle>(null);

  const getTagList = useCallback(() => {
    doGet(
      getMutedTagsUrl,
      (response: any) => {
        setTagList(response.data.tag_list);
        setDataLoading(false);
      },
      "Error getting muted tags"
    );
  }, [getMutedTagsUrl]);

  useEffect(() => {
    getTagList();
  }, [getTagList]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Auto-focus the search input after open
  useEffect(() => {
    if (!isModalOpen) return;
    const t = window.setTimeout(() => {
      selectValueRef.current?.focus();
    }, 40);
    return () => window.clearTimeout(t);
  }, [isModalOpen]);

  // Escape closes the modal
  useEffect(() => {
    if (!isModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isModalOpen, closeModal]);

  const handleTagMute = useCallback(
    (tag: string) => {
      doPost(muteTagUrl, { tag }, () => {
        getTagList();
      });
    },
    [muteTagUrl, getTagList]
  );

  const handleTagUnmute = useCallback(
    (tagName: string) => {
      doPost(unmuteTagUrl, { tag: tagName }, () => {
        getTagList();
      });
    },
    [unmuteTagUrl, getTagList]
  );

  const handleTagSelect = useCallback(
    (selection: any) => {
      handleTagMute(selection.label || selection.name);
    },
    [handleTagMute]
  );

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const titleSlot = (
    <div className="card-title flex items-center">
      <div>Muted Tags</div>
      <div className="ms-auto">
        <DropDownMenu
          iconSlot={<FontAwesomeIcon icon={faEllipsisV} />}
          dropdownSlot={
            <ul className="dropdown-menu-list">
              <li key="manage">
                <a
                  className="dropdown-menu-item"
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    openModal();
                  }}
                >
                  <span className="dropdown-menu-icon">
                    <FontAwesomeIcon icon={faPencilAlt} />
                  </span>
                  <span className="dropdown-menu-text">Manage</span>
                </a>
              </li>
            </ul>
          }
        />
      </div>
    </div>
  );

  return (
    <div className="flex grow">
      {isModalOpen &&
        createPortal(
          <>
            <div className="refined-modal-scrim" onClick={closeModal} />
            <div
              className="refined-modal refined-modal--tag-manage"
              role="dialog"
              aria-label="manage muted tags"
            >
              <button
                type="button"
                className="refined-modal-close"
                onClick={closeModal}
                aria-label="close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>

              <h2 className="refined-modal-title">Muted tags</h2>

              <div className="refined-field">
                <label htmlFor="drill-muted-tag-search">add tag</label>
                <SelectValue
                  ref={selectValueRef}
                  searchUrl={`${tagSearchUrl}?doctype=drill&query=`}
                  placeHolder="Search tag"
                  onSelect={handleTagSelect}
                />
              </div>

              <div className="refined-field">
                <label>currently muted</label>
                <ul className="muted-tag-list">
                  {tagList.length === 0 && <li className="muted-tag-empty">No muted tags.</li>}
                  {tagList.map(tag => (
                    <li key={tag.name} className="muted-tag-item">
                      <span className="muted-tag-name">{tag.name}</span>
                      <FontAwesomeIcon
                        icon={faTimesCircle}
                        className="muted-tag-remove cursor-pointer"
                        onClick={() => handleTagUnmute(tag.name)}
                        aria-label={`Unmute ${tag.name}`}
                      />
                    </li>
                  ))}
                </ul>
              </div>

              <div className="refined-modal-actions">
                <button type="button" className="refined-btn primary" onClick={closeModal}>
                  Done
                </button>
              </div>
            </div>
          </>,
          document.body
        )}

      {/* Card component */}
      <Card
        className="backdrop-filter hover-target grow"
        cardClassName="grow"
        titleSlot={titleSlot}
      >
        <hr className="divider" />
        {dataLoading ? (
          <div className="text-ink-2">Data Loading...</div>
        ) : (
          <ul className="list-unstyled">
            {tagList.map(tag => (
              <li key={tag.name} className="flex px-2">
                <div className="item-name flex-auto">
                  <a href={`${tag.url}?filter=review`}>{tag.name}</a>
                </div>
                <div className="item-value">{tag.progress}%</div>
              </li>
            ))}
            {tagList.length === 0 && (
              <li key="add-tag">
                <a
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    openModal();
                  }}
                >
                  Add a tag
                </a>
              </li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default DrillMutedTags;
