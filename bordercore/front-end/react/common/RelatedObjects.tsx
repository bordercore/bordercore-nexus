import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookmark,
  faPlus,
  faTrashAlt,
  faPencilAlt,
} from "@fortawesome/free-solid-svg-icons";
import Card from "./Card";
import DropDownMenu from "./DropDownMenu";
import { doGet, doPost } from "../utils/reactUtils";

interface RelatedObject {
  uuid: string;
  name: string;
  url: string;
  edit_url: string;
  type: string;
  cover_url?: string;
  cover_url_large?: string;
  note?: string;
  noteIsEditable?: boolean;
}

interface RelatedObjectsProps {
  objectUuid: string;
  title?: string;
  nodeType?: string;
  relatedObjectsUrl: string;
  newObjectUrl: string;
  removeObjectUrl: string;
  sortRelatedObjectsUrl: string;
  editRelatedObjectNoteUrl: string;
  searchNamesUrl: string;
  showEmptyList?: boolean;
  onOpenObjectSelectModal?: () => void;
}

export interface RelatedObjectsHandle {
  refresh: () => void;
}

export const RelatedObjects = forwardRef<RelatedObjectsHandle, RelatedObjectsProps>(function RelatedObjects({
  objectUuid,
  title = "Related Objects",
  nodeType = "drill",
  relatedObjectsUrl,
  newObjectUrl,
  removeObjectUrl,
  sortRelatedObjectsUrl,
  editRelatedObjectNoteUrl,
  searchNamesUrl,
  showEmptyList = true,
  onOpenObjectSelectModal,
}, ref) {
  const [objectList, setObjectList] = useState<RelatedObject[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const getRelatedObjects = useCallback(() => {
    doGet(
      relatedObjectsUrl,
      (response: any) => {
        setObjectList(response.data.related_objects || []);
        setDataLoading(false);
      },
      "Error getting related objects"
    );
  }, [relatedObjectsUrl]);

  useImperativeHandle(ref, () => ({
    refresh: getRelatedObjects,
  }), [getRelatedObjects]);

  useEffect(() => {
    getRelatedObjects();
  }, [getRelatedObjects]);

  const handleRemoveObject = useCallback(
    (bcObject: RelatedObject) => {
      doPost(
        removeObjectUrl,
        {
          node_uuid: objectUuid,
          object_uuid: bcObject.uuid,
          node_type: nodeType,
        },
        () => {
          getRelatedObjects();
        }
      );
    },
    [removeObjectUrl, objectUuid, nodeType, getRelatedObjects]
  );

  const handleEditNote = useCallback(
    (bcObject: RelatedObject, note: string) => {
      // Update local state to hide input
      setObjectList((prev) =>
        prev.map((obj) =>
          obj.uuid === bcObject.uuid ? { ...obj, noteIsEditable: false } : obj
        )
      );

      // If the note hasn't changed, abort
      if (note === bcObject.note) {
        return;
      }

      doPost(
        editRelatedObjectNoteUrl,
        {
          node_uuid: objectUuid,
          object_uuid: bcObject.uuid,
          note: note,
          node_type: nodeType,
        },
        () => {
          getRelatedObjects();
        }
      );
    },
    [editRelatedObjectNoteUrl, objectUuid, nodeType, getRelatedObjects]
  );

  const toggleNoteEditable = useCallback((uuid: string, editable: boolean) => {
    setObjectList((prev) =>
      prev.map((obj) =>
        obj.uuid === uuid ? { ...obj, noteIsEditable: editable } : obj
      )
    );
    if (editable) {
      setTimeout(() => {
        inputRefs.current[uuid]?.focus();
      }, 50);
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
        const newList = [...objectList];
        const [draggedItem] = newList.splice(dragIndex, 1);
        newList.splice(dropIndex, 0, draggedItem);

        setObjectList(newList);

        const newPosition = dropIndex + 1;

        doPost(
          sortRelatedObjectsUrl,
          {
            node_uuid: objectUuid,
            object_uuid: draggedItem.uuid,
            new_position: newPosition,
            node_type: nodeType,
          },
          () => {}
        );
      }

      setDraggingIndex(null);
      setDragOverIndex(null);
    },
    [objectList, sortRelatedObjectsUrl, objectUuid, nodeType]
  );

  const openModal = useCallback(() => {
    onOpenObjectSelectModal?.();
  }, [onOpenObjectSelectModal]);

  if (!showEmptyList && objectList.length === 0 && !dataLoading) {
    return null;
  }

  const titleSlot = (
    <div className="d-flex">
      <div className="card-title d-flex">
        <FontAwesomeIcon icon={faBookmark} className="text-primary me-3 mt-1" />
        {title}
      </div>
      <div className="dropdown-menu-container ms-auto">
        <DropDownMenu
          showOnHover={false}
          dropdownSlot={
            <ul className="dropdown-menu-list">
              <li key="new-object">
                <a
                  className="dropdown-item"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    openModal();
                  }}
                >
                  <FontAwesomeIcon icon={faPlus} className="text-primary me-3" />
                  New Object
                </a>
              </li>
            </ul>
          }
        />
      </div>
    </div>
  );

  return (
    <Card
      className="backdrop-filter position-relative z-index-positive"
      cardClassName="mb-gutter"
      titleSlot={titleSlot}
    >
      <hr className="divider" />
      {dataLoading ? (
        <div className="text-secondary">Loading...</div>
      ) : objectList.length === 0 ? (
        <div className="text-muted">No related objects</div>
      ) : (
        <ul className="list-group list-group-flush interior-borders mb-0">
          {objectList.map((element, index) => (
            <div
              key={element.uuid}
              className={`slicklist-item show-child-on-hover ${
                draggingIndex === index ? "dragging" : ""
              } ${dragOverIndex === index ? "drag-over" : ""}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              // Dynamic z-index based on drag index - must remain inline
              style={{ zIndex: 1000 - index }}
            >
              <div className="slicklist-list-item-inner">
                <li className="list-group-item list-group-item-secondary px-0">
                  <div className="dropdown-height d-flex align-items-start">
                    <div className="d-flex flex-column flex-grow-1">
                      {element.type === "bookmark" && element.cover_url && (
                        <div className="pe-2">
                          <img
                            src={element.cover_url}
                            width="120"
                            height="67"
                            alt=""
                          />
                        </div>
                      )}
                      {element.type === "blob" && element.cover_url && (
                        <div className="pe-2">
                          <img src={element.cover_url} alt="" />
                        </div>
                      )}
                      <div>
                        <a href={element.url}>{element.name}</a>
                      </div>
                      {!element.noteIsEditable ? (
                        <div
                          className="node-object-note text-muted small"
                          onClick={() => toggleNoteEditable(element.uuid, true)}
                          className="cursor-pointer"
                        >
                          {element.note}
                        </div>
                      ) : (
                        <div>
                          <input
                            ref={(el) => {
                              inputRefs.current[element.uuid] = el;
                            }}
                            type="text"
                            className="form-control form-control-sm"
                            defaultValue={element.note || ""}
                            placeholder=""
                            autoComplete="off"
                            onBlur={(e) => handleEditNote(element, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleEditNote(element, (e.target as HTMLInputElement).value);
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="show-on-hover">
                      <DropDownMenu
                        showOnHover={true}
                        dropdownSlot={
                          <ul className="dropdown-menu-list">
                            <li key="remove">
                              <a
                                className="dropdown-item"
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleRemoveObject(element);
                                }}
                              >
                                <FontAwesomeIcon
                                  icon={faTrashAlt}
                                  className="text-primary me-3"
                                />
                                Remove
                              </a>
                            </li>
                            <li key="edit">
                              <a className="dropdown-item" href={element.edit_url}>
                                <FontAwesomeIcon
                                  icon={faPencilAlt}
                                  className="text-primary me-3"
                                />
                                Edit {element.type}
                              </a>
                            </li>
                            <li key="note">
                              <a
                                className="dropdown-item"
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  toggleNoteEditable(element.uuid, true);
                                }}
                              >
                                <FontAwesomeIcon
                                  icon={element.note ? faPencilAlt : faPlus}
                                  className="text-primary me-3"
                                />
                                {element.note ? "Edit" : "New"} note
                              </a>
                            </li>
                          </ul>
                        }
                      />
                    </div>
                  </div>
                </li>
              </div>
            </div>
          ))}
        </ul>
      )}
    </Card>
  );
});

export default RelatedObjects;
