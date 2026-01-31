import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSplotch,
  faPlus,
  faExternalLinkAlt,
  faPencilAlt,
  faTimes,
  faTrashAlt,
  faBookmark,
  faGripVertical,
} from "@fortawesome/free-solid-svg-icons";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "../common/Card";
import { DropDownMenu } from "../common/DropDownMenu";
import { doGet, doPost } from "../utils/reactUtils";
import type { CollectionLayoutItem } from "./types";
import type { CollectionSettings } from "./NodeCollectionModal";

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

interface CollectionObject {
  uuid: string;
  name: string;
  url: string;
  type: "blob" | "bookmark";
  cover_url?: string;
  cover_url_large?: string;
  favicon_url?: string;
  note?: string;
}

interface SortableItemProps {
  element: CollectionObject;
  editingNoteUuid: string | null;
  onRemove: (uuid: string) => void;
  onEditNote: (uuid: string, note: string) => void;
  onStartEditNote: (uuid: string) => void;
}

function SortableItem({
  element,
  editingNoteUuid,
  onRemove,
  onEditNote,
  onStartEditNote,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.uuid });

  const nodeRef = useRef<HTMLDivElement | null>(null);
  const setRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    nodeRef.current = el;
  };

  useLayoutEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    el.style.transform = CSS.Transform.toString(transform);
    el.style.transition = transition;
  }, [transform, transition]);

  return (
    <div
      ref={setRef}
      className={`slicklist-item ${isDragging ? "dragging" : ""}`}
    >
      <div className="slicklist-list-item-inner">
        <li
          className="hover-target list-group-item pe-0"
          data-uuid={element.uuid}
        >
          <div className="dropdown-height d-flex align-items-start">
            <div
              className="drag-handle pe-2 cursor-grab"
              {...attributes}
              {...listeners}
            >
              <FontAwesomeIcon icon={faGripVertical} className="text-secondary" />
            </div>
            {element.type === "blob" ? (
              <div className="pe-2">
                <img src={element.cover_url} height="75" width="70" alt="" />
              </div>
            ) : (
              <div className="pe-2">
                <FontAwesomeIcon icon={faBookmark} className="text-secondary" />
              </div>
            )}

            <div>
              <a href={element.url}>{element.name}</a>
              {editingNoteUuid === element.uuid ? (
                <input
                  type="text"
                  className="form-control form-control-sm"
                  defaultValue={element.note || ""}
                  autoFocus
                  onBlur={(e) => onEditNote(element.uuid, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onEditNote(element.uuid, (e.target as HTMLInputElement).value);
                    }
                  }}
                />
              ) : element.note ? (
                <div
                  className="node-object-note cursor-pointer"
                  onClick={() => onStartEditNote(element.uuid)}
                >
                  {element.note}
                </div>
              ) : null}
            </div>

            <div className="ms-auto">
              <DropDownMenu
                showOnHover
                dropdownSlot={
                  <ul className="dropdown-menu-list">
                    <li>
                      <a
                        href="#"
                        className="dropdown-menu-item"
                        onClick={(e) => {
                          e.preventDefault();
                          onRemove(element.uuid);
                        }}
                      >
                        <span className="dropdown-menu-icon">
                          <FontAwesomeIcon icon={faTrashAlt} className="text-primary" />
                        </span>
                        <span className="dropdown-menu-text">Remove</span>
                      </a>
                    </li>
                    <li>
                      <a
                        href="#"
                        className="dropdown-menu-item"
                        onClick={(e) => {
                          e.preventDefault();
                          onStartEditNote(element.uuid);
                        }}
                      >
                        <span className="dropdown-menu-icon">
                          <FontAwesomeIcon icon={faPencilAlt} className="text-primary" />
                        </span>
                        <span className="dropdown-menu-text">
                          {element.note ? "Edit" : "Add"} Note
                        </span>
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
  );
}

interface NodeCollectionCardProps {
  nodeUuid: string;
  collectionInitial: CollectionLayoutItem;
  addNewBookmarkUrl: string;
  collectionDetailUrl: string;
  editCollectionUrl: string;
  getObjectListUrl: string;
  editObjectNoteUrl: string;
  removeObjectUrl: string;
  sortObjectsUrl: string;
  deleteCollectionUrl: string;
  onOpenCollectionEditModal: (
    callback: (settings: CollectionSettings) => void,
    data: CollectionSettings
  ) => void;
  onOpenObjectSelectModal: (
    callback: () => void,
    data: { collectionUuid: string }
  ) => void;
  onOpenImageModal: (imageUrl: string) => void;
  onEditLayout: (layout: string) => void;
}

export default function NodeCollectionCard({
  nodeUuid,
  collectionInitial,
  addNewBookmarkUrl,
  collectionDetailUrl,
  editCollectionUrl,
  getObjectListUrl,
  editObjectNoteUrl,
  removeObjectUrl,
  sortObjectsUrl,
  deleteCollectionUrl,
  onOpenCollectionEditModal,
  onOpenObjectSelectModal,
  onOpenImageModal,
  onEditLayout,
}: NodeCollectionCardProps) {
  const [collection, setCollection] = useState<CollectionLayoutItem>(collectionInitial);
  const [objectList, setObjectList] = useState<CollectionObject[]>([]);
  const [objectCount, setObjectCount] = useState(0);
  const [currentObjectIndex, setCurrentObjectIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [editingNoteUuid, setEditingNoteUuid] = useState<string | null>(null);

  const rotateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    getObjectList();
    return () => {
      if (rotateIntervalRef.current) {
        clearInterval(rotateIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isHovered || collection.display !== "individual") return;

      switch (e.key) {
        case "ArrowLeft":
          showPreviousObject();
          break;
        case "ArrowRight":
          showNextObject();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isHovered, objectList.length, currentObjectIndex, collection.display]);

  const getObjectList = () => {
    doGet(
      `${getObjectListUrl}?random_order=${collection.random_order}`,
      (response) => {
        setObjectList(response.data.object_list);
        setObjectCount(response.data.paginator?.count || response.data.object_list.length);
        setCurrentObjectIndex(0);
        if (collection.rotate !== null && collection.rotate !== -1) {
          setTimer();
        }
      },
      "Error getting object list"
    );
  };

  const setTimer = () => {
    if (!collection.rotate || collection.rotate === -1) return;

    if (rotateIntervalRef.current) {
      clearInterval(rotateIntervalRef.current);
    }

    rotateIntervalRef.current = setInterval(() => {
      showNextObject();
    }, collection.rotate * 1000 * 60);
  };

  const showNextObject = () => {
    setCurrentObjectIndex((prev) =>
      prev === objectList.length - 1 ? 0 : prev + 1
    );
  };

  const showPreviousObject = () => {
    setCurrentObjectIndex((prev) =>
      prev === 0 ? objectList.length - 1 : prev - 1
    );
  };

  const handleEditCollection = (settings: CollectionSettings) => {
    const limitValue = (settings.limit != null && typeof settings.limit === "number")
      ? settings.limit.toString()
      : "";
    doPost(
      editCollectionUrl,
      {
        collection_uuid: collection.uuid,
        node_uuid: nodeUuid,
        name: settings.name,
        display: settings.display,
        random_order: settings.random_order ? "true" : "false",
        rotate: settings.rotate.toString(),
        limit: limitValue,
      },
      () => {
        setCollection((prev) => ({
          ...prev,
          name: settings.name,
          display: settings.display as "list" | "individual",
          rotate: settings.rotate,
          random_order: settings.random_order,
          limit: settings.limit,
        }));
        setTimer();
      },
      "Collection edited"
    );
  };

  const handleDeleteCollection = () => {
    doPost(
      deleteCollectionUrl,
      {
        node_uuid: nodeUuid,
        collection_uuid: collection.uuid,
        collection_type: collection.collection_type,
      },
      (response) => {
        onEditLayout(response.data.layout);
      },
      "Collection deleted"
    );
  };

  const handleRemoveObject = (objectUuid: string) => {
    doPost(
      removeObjectUrl,
      {
        collection_uuid: collection.uuid,
        object_uuid: objectUuid,
      },
      () => {
        getObjectList();
      },
      "Object removed"
    );
  };

  const handleEditNote = (objectUuid: string, note: string) => {
    const object = objectList.find((o) => o.uuid === objectUuid);
    if (note === object?.note) {
      setEditingNoteUuid(null);
      return;
    }

    doPost(
      editObjectNoteUrl,
      {
        collection_uuid: collection.uuid,
        object_uuid: objectUuid,
        note: note,
      },
      () => {
        getObjectList();
        setEditingNoteUuid(null);
      }
    );
  };

  const handleObjectClick = () => {
    if (objectList.length > 0 && objectList[currentObjectIndex]) {
      onOpenImageModal(objectList[currentObjectIndex].cover_url_large || "");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = objectList.findIndex((item) => item.uuid === active.id);
      const newIndex = objectList.findIndex((item) => item.uuid === over.id);

      const newList = arrayMove(objectList, oldIndex, newIndex);
      setObjectList(newList);

      // Backend expects 1-indexed position
      const newPosition = newIndex + 1;
      doPost(
        sortObjectsUrl,
        {
          collection_uuid: collection.uuid,
          object_uuid: active.id.toString(),
          new_position: newPosition.toString(),
        },
        () => {}
      );
    }
  };

  const handleObjectDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const url = e.dataTransfer.getData("URL");
    if (!url || url.trim() === "") return;

    doPost(
      addNewBookmarkUrl,
      {
        collection_uuid: collection.uuid,
        url: url,
      },
      () => {
        getObjectList();
      },
      "Bookmark added"
    );
  };

  const openEditModal = () => {
    onOpenCollectionEditModal(handleEditCollection, {
      uuid: collection.uuid,
      name: collection.name,
      collection_type: collection.collection_type,
      display: collection.display,
      rotate: collection.rotate,
      random_order: collection.random_order,
      limit: collection.limit,
      objectCount: objectCount,
    });
  };

  const openObjectSelectModal = () => {
    onOpenObjectSelectModal(getObjectList, { collectionUuid: collection.uuid });
  };

  const limitedObjectList = collection.limit
    ? objectList.slice(0, collection.limit)
    : objectList;

  const dropdownContent = (
    <ul className="dropdown-menu-list">
      {collection.collection_type === "ad-hoc" && (
        <li>
          <a
            href="#"
            className="dropdown-menu-item"
            onClick={(e) => {
              e.preventDefault();
              openObjectSelectModal();
            }}
          >
            <span className="dropdown-menu-icon">
              <FontAwesomeIcon icon={faPlus} className="text-primary" />
            </span>
            <span className="dropdown-menu-text">Add Object</span>
          </a>
        </li>
      )}
      {collection.collection_type !== "ad-hoc" && (
        <li>
          <a
            href={collectionDetailUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dropdown-menu-item"
          >
            <span className="dropdown-menu-icon">
              <FontAwesomeIcon icon={faExternalLinkAlt} className="text-primary" />
            </span>
            <span className="dropdown-menu-text">Collection Detail</span>
          </a>
        </li>
      )}
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={(e) => {
            e.preventDefault();
            openEditModal();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faPencilAlt} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">Edit Collection</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={(e) => {
            e.preventDefault();
            handleDeleteCollection();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faTimes} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">
            {collection.collection_type === "ad-hoc" ? "Delete" : "Remove"} Collection
          </span>
        </a>
      </li>
    </ul>
  );

  const titleSlot = (
    <div className="card-title d-flex">
      <div className="text-truncate">
        <FontAwesomeIcon icon={faSplotch} className="text-primary me-3" />
        {collection.name}
      </div>
      <div className="text-secondary text-small text-nowrap ms-3">
        {objectCount} <span>{pluralize("object", objectCount)}</span>
      </div>
      <div className="dropdown-menu-container dropdown-menu-container-width ms-auto hover-reveal-content">
        <DropDownMenu showOnHover={false} dropdownSlot={dropdownContent} />
      </div>
    </div>
  );

  return (
    <div
      className="hover-reveal-target"
      onMouseOver={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleObjectDrop}
    >
      <Card cardClassName="backdrop-filter node-color-1 position-relative" titleSlot={titleSlot}>
        <hr className="divider" />
        {collection.display === "individual" ? (
          <div className="drag-target">
            {currentObjectIndex !== null && objectList.length > 0 ? (
              <img
                src={objectList[currentObjectIndex]?.cover_url_large}
                className="mw-100 cursor-pointer"
                onClick={handleObjectClick}
                alt=""
              />
            ) : (
              <span className="text-muted">No objects</span>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={limitedObjectList.map((item) => item.uuid)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="drag-target list-group list-group-flush interior-borders">
                {limitedObjectList.map((element) => (
                  <SortableItem
                    key={element.uuid}
                    element={element}
                    editingNoteUuid={editingNoteUuid}
                    onRemove={handleRemoveObject}
                    onEditNote={handleEditNote}
                    onStartEditNote={setEditingNoteUuid}
                  />
                ))}
                {objectList.length === 0 && <div className="text-muted">No objects</div>}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </Card>
    </div>
  );
}
