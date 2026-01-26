import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimesCircle, faEllipsisV, faPencilAlt } from "@fortawesome/free-solid-svg-icons";
import Card from "../common/Card";
import DropDownMenu from "../common/DropDownMenu";
import SelectValue, { SelectValueHandle } from "../common/SelectValue";
import { doGet, doPost } from "../utils/reactUtils";

interface PinnedTag {
  name: string;
  url: string;
  progress: number;
  count: number;
  last_reviewed: string;
}

interface DrillPinnedTagsProps {
  getPinnedTagsUrl: string;
  pinTagUrl: string;
  unpinTagUrl: string;
  sortPinnedTagsUrl: string;
  tagSearchUrl: string;
}

export function DrillPinnedTags({
  getPinnedTagsUrl,
  pinTagUrl,
  unpinTagUrl,
  sortPinnedTagsUrl,
  tagSearchUrl,
}: DrillPinnedTagsProps) {
  const [dataLoading, setDataLoading] = useState(true);
  const [tagList, setTagList] = useState<PinnedTag[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const selectValueRef = useRef<SelectValueHandle>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalInstanceRef = useRef<Modal | null>(null);

  const getTagList = useCallback(() => {
    doGet(
      getPinnedTagsUrl,
      (response: any) => {
        setTagList(response.data.tag_list);
        setDataLoading(false);
      },
      "Error getting pinned tags"
    );
  }, [getPinnedTagsUrl]);

  useEffect(() => {
    getTagList();
  }, [getTagList]);

  useEffect(() => {
    if (modalRef.current && !modalInstanceRef.current) {
      modalInstanceRef.current = new Modal(modalRef.current);
    }
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
      setDraggingIndex(index);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggingIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggingIndex]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
      e.preventDefault();
      const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);

      if (!isNaN(dragIndex) && dragIndex !== dropIndex) {
        // Reorder the list locally for immediate visual feedback
        const newList = [...tagList];
        const [draggedItem] = newList.splice(dragIndex, 1);
        newList.splice(dropIndex, 0, draggedItem);

        setTagList(newList);

        // The backend expects the ordering to begin with 1, not 0
        const newPosition = dropIndex + 1;

        doPost(
          sortPinnedTagsUrl,
          {
            tag_name: draggedItem.name,
            new_position: newPosition,
          },
          () => {}
        );
      }

      setDraggingIndex(null);
      setDragOverIndex(null);
    },
    [tagList, sortPinnedTagsUrl]
  );

  const handleTagAdd = useCallback(
    (tag: string) => {
      doPost(
        pinTagUrl,
        { tag },
        () => {
          getTagList();
        }
      );
    },
    [pinTagUrl, getTagList]
  );

  const handleTagDelete = useCallback(
    (tagName: string) => {
      doPost(
        unpinTagUrl,
        { tag: tagName },
        () => {
          getTagList();
        }
      );
    },
    [unpinTagUrl, getTagList]
  );

  const handleTagSelect = useCallback(
    (selection: any) => {
      handleTagAdd(selection.label || selection.name);
    },
    [handleTagAdd]
  );

  const openModal = useCallback(() => {
    if (modalInstanceRef.current) {
      modalInstanceRef.current.show();
      setTimeout(() => {
        selectValueRef.current?.focus();
      }, 500);
    }
  }, []);

  const titleSlot = (
    <div className="card-title d-flex align-items-center">
      <div>Pinned Tags</div>
      <div className="ms-auto">
        <DropDownMenu
          showOnHover={true}
          iconSlot={<FontAwesomeIcon icon={faEllipsisV} />}
          dropdownSlot={
            <ul className="dropdown-menu-list">
              <li key="manage">
                <a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); openModal(); }}>
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
    <>
      {/* Modal for managing pinned tags */}
      <div
        ref={modalRef}
        id="modalNewTag"
        className="modal fade"
        tabIndex={-1}
        role="dialog"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 id="myModalLabel" className="modal-title">
                Pinned Tags
              </h4>
              <button
                type="button"
                className="close-button btn-close"
                data-bs-dismiss="modal"
              />
            </div>
            <div className="modal-body">
              <div className="form-row align-items-center">
                <div className="form-row mx-1 w-100">
                  <SelectValue
                    ref={selectValueRef}
                    searchUrl={`${tagSearchUrl}?doctype=drill&query=`}
                    placeHolder="New Tag"
                    onSelect={handleTagSelect}
                  />
                </div>
              </div>
              <ul
                id="drill-pinned-tags"
                className="interior-borders p-2 mb-0 wide-list"
              >
                {tagList.map((element, index) => (
                  <div
                    key={element.name}
                    className={`slicklist-item show-child-on-hover ${
                      draggingIndex === index ? "dragging" : ""
                    } ${dragOverIndex === index ? "drag-over" : ""}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    <div className="slicklist-list-item-inner">
                      <li className="list-group-item px-2 py-1">
                        <div className="d-flex">
                          <div>{element.name}</div>
                          <div className="ms-auto my-auto show-on-hover">
                            <FontAwesomeIcon
                              icon={faTimesCircle}
                              className="list-delete"
                              onClick={() => handleTagDelete(element.name)}
                              className="cursor-pointer"
                            />
                          </div>
                        </div>
                      </li>
                    </div>
                  </div>
                ))}
              </ul>
            </div>
            <div className="modal-footer justify-content-start">
              <input
                className="btn btn-primary"
                type="button"
                value="Save"
                data-bs-dismiss="modal"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card component */}
      <Card
        className="backdrop-filter hover-target"
        cardClassName="mb-gutter"
        titleSlot={titleSlot}
      >
        <hr className="divider" />
        {dataLoading ? (
          <div className="text-secondary">Data Loading...</div>
        ) : (
          <ul className="list-unstyled">
            {tagList.map((tag) => (
              <li key={tag.name} className="d-flex px-2">
                <div className="item-name flex-fill">
                  <a href={tag.url}>{tag.name}</a>
                </div>
                <div className="item-value">{tag.progress}%</div>
              </li>
            ))}
            {tagList.length === 0 && (
              <li key="add-tag">
                <a href="#" onClick={(e) => { e.preventDefault(); openModal(); }}>
                  Add a tag
                </a>
              </li>
            )}
          </ul>
        )}
      </Card>
    </>
  );
}

export default DrillPinnedTags;
