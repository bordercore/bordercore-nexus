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

interface DisabledTag {
  name: string;
  url: string;
  progress: number;
  count: number;
  last_reviewed: string;
}

interface DrillDisabledTagsProps {
  getDisabledTagsUrl: string;
  disableTagUrl: string;
  enableTagUrl: string;
  tagSearchUrl: string;
}

export function DrillDisabledTags({
  getDisabledTagsUrl,
  disableTagUrl,
  enableTagUrl,
  tagSearchUrl,
}: DrillDisabledTagsProps) {
  const [dataLoading, setDataLoading] = useState(true);
  const [tagList, setTagList] = useState<DisabledTag[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const selectValueRef = useRef<SelectValueHandle>(null);

  const getTagList = useCallback(() => {
    doGet(
      getDisabledTagsUrl,
      (response: any) => {
        setTagList(response.data.tag_list);
        setDataLoading(false);
      },
      "Error getting disabled tags"
    );
  }, [getDisabledTagsUrl]);

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

  const handleTagDisable = useCallback(
    (tag: string) => {
      doPost(disableTagUrl, { tag }, () => {
        getTagList();
      });
    },
    [disableTagUrl, getTagList]
  );

  const handleTagEnable = useCallback(
    (tagName: string) => {
      doPost(enableTagUrl, { tag: tagName }, () => {
        getTagList();
      });
    },
    [enableTagUrl, getTagList]
  );

  const handleTagSelect = useCallback(
    (selection: any) => {
      handleTagDisable(selection.label || selection.name);
    },
    [handleTagDisable]
  );

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const titleSlot = (
    <div className="card-title d-flex align-items-center">
      <div>Disabled Tags</div>
      <div className="ms-auto">
        <DropDownMenu
          iconSlot={<FontAwesomeIcon icon={faEllipsisV} />}
          dropdownSlot={
            <ul className="dropdown-menu-list">
              <li key="manage">
                <a
                  className="dropdown-item"
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    openModal();
                  }}
                >
                  <FontAwesomeIcon icon={faPencilAlt} className="text-primary me-3" />
                  Manage
                </a>
              </li>
            </ul>
          }
        />
      </div>
    </div>
  );

  return (
    <div className="d-flex flex-grow-1">
      {isModalOpen &&
        createPortal(
          <>
            <div className="refined-modal-scrim" onClick={closeModal} />
            <div className="refined-modal" role="dialog" aria-label="manage disabled tags">
              <button
                type="button"
                className="refined-modal-close"
                onClick={closeModal}
                aria-label="close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>

              <h2 className="refined-modal-title">Disabled tags</h2>

              <div className="refined-field">
                <label htmlFor="drill-disabled-tag-search">add tag</label>
                <SelectValue
                  ref={selectValueRef}
                  searchUrl={`${tagSearchUrl}?doctype=drill&query=`}
                  placeHolder="Search tag"
                  onSelect={handleTagSelect}
                />
              </div>

              <div className="refined-field">
                <label>currently disabled</label>
                <ul className="disabled-tag-list">
                  {tagList.length === 0 && (
                    <li className="disabled-tag-empty">No disabled tags.</li>
                  )}
                  {tagList.map(tag => (
                    <li key={tag.name} className="disabled-tag-item">
                      <span className="disabled-tag-name">{tag.name}</span>
                      <FontAwesomeIcon
                        icon={faTimesCircle}
                        className="disabled-tag-remove cursor-pointer"
                        onClick={() => handleTagEnable(tag.name)}
                        aria-label={`Re-enable ${tag.name}`}
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
        className="backdrop-filter hover-target flex-grow-1"
        cardClassName="flex-grow-1"
        titleSlot={titleSlot}
      >
        <hr className="divider" />
        {dataLoading ? (
          <div className="text-secondary">Data Loading...</div>
        ) : (
          <ul className="list-unstyled">
            {tagList.map(tag => (
              <li key={tag.name} className="d-flex px-2">
                <div className="item-name flex-fill">
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

export default DrillDisabledTags;
