import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimesCircle, faEllipsisV, faPencilAlt } from "@fortawesome/free-solid-svg-icons";
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    <>
      {/* Modal for managing pinned tags */}
      <div ref={modalRef} id="modalNewTag" className="modal fade" tabIndex={-1} role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h4 id="myModalLabel" className="modal-title">
                Pinned Tags
              </h4>
              <button type="button" className="close-button btn-close" data-bs-dismiss="modal" />
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
                    {tagList.map((element, index) => (
                      <SortablePinnedTag
                        key={element.name}
                        element={element}
                        onDelete={handleTagDelete}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    position: "relative" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`slicklist-item show-child-on-hover ${isDragging ? "dragging" : ""}`}
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
