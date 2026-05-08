import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimesCircle,
  faEllipsisV,
  faPencilAlt,
  faTimes,
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const selectValueRef = useRef<SelectValueHandle>(null);

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

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Auto-focus the SelectValue after the modal opens
  useEffect(() => {
    if (!isModalOpen) return;
    const t = window.setTimeout(() => {
      selectValueRef.current?.focus();
    }, 40);
    return () => window.clearTimeout(t);
  }, [isModalOpen]);

  // Escape-to-close
  useEffect(() => {
    if (!isModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isModalOpen, closeModal]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = tagList.findIndex(item => item.name === active.id);
        const newIndex = tagList.findIndex(item => item.name === over.id);

        const newList = arrayMove(tagList, oldIndex, newIndex);
        setTagList(newList);

        const newPosition = newIndex + 1;

        doPost(
          sortPinnedTagsUrl,
          {
            tag_name: active.id as string,
            new_position: newPosition,
          },
          () => {}
        );
      }
    },
    [tagList, sortPinnedTagsUrl]
  );

  const handleTagAdd = useCallback(
    (tag: string) => {
      doPost(pinTagUrl, { tag }, () => {
        getTagList();
      });
    },
    [pinTagUrl, getTagList]
  );

  const handleTagDelete = useCallback(
    (tagName: string) => {
      doPost(unpinTagUrl, { tag: tagName }, () => {
        getTagList();
      });
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
    setIsModalOpen(true);
  }, []);

  const titleSlot = (
    <div className="card-title d-flex align-items-center">
      <div>Pinned Tags</div>
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
    <>
      {/* Refined modal for managing pinned tags */}
      {isModalOpen &&
        createPortal(
          <>
            <div className="refined-modal-scrim" onClick={closeModal} />
            <div className="refined-modal" role="dialog" aria-label="manage pinned tags">
              <button
                type="button"
                className="refined-modal-close"
                onClick={closeModal}
                aria-label="close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>

              <h2 className="refined-modal-title">Pinned tags</h2>

              <div className="refined-field">
                <SelectValue
                  ref={selectValueRef}
                  searchUrl={`${tagSearchUrl}?doctype=drill&query=`}
                  placeHolder="New Tag"
                  onSelect={handleTagSelect}
                />
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={tagList.map(item => item.name)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul id="drill-pinned-tags" className="interior-borders p-2 mb-0 wide-list">
                    {tagList.map(element => (
                      <SortablePinnedTag
                        key={element.name}
                        element={element}
                        onDelete={handleTagDelete}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

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
        className="backdrop-filter hover-target"
        cardClassName="mb-gutter"
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
                  <a href={tag.url}>{tag.name}</a>
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
    </>
  );
}

export default DrillPinnedTags;

interface SortablePinnedTagProps {
  element: PinnedTag;
  onDelete: (tagName: string) => void;
}

function SortablePinnedTag({ element, onDelete }: SortablePinnedTagProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: element.name,
  });
  const elRef = useRef<HTMLDivElement | null>(null);

  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      setNodeRef(el);
      elRef.current = el;
    },
    [setNodeRef]
  );

  useLayoutEffect(() => {
    const el = elRef.current;
    if (el) {
      el.style.setProperty("--sortable-transform", CSS.Transform.toString(transform) ?? "none");
      el.style.setProperty("--sortable-transition", transition ?? "none");
    }
  }, [transform, transition]);

  return (
    <div
      ref={refCallback}
      className={`slicklist-item sortable-slicklist-item show-child-on-hover ${isDragging ? "dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="slicklist-list-item-inner">
        <li className="list-group-item px-2 py-1">
          <div className="d-flex">
            <div>{element.name}</div>
            <div className="ms-auto my-auto show-on-hover" onPointerDown={e => e.stopPropagation()}>
              <FontAwesomeIcon
                icon={faTimesCircle}
                className="list-delete cursor-pointer"
                onClick={() => onDelete(element.name)}
              />
            </div>
          </div>
        </li>
      </div>
    </div>
  );
}
