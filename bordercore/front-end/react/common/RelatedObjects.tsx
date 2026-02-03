import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookmark, faPlus, faTrashAlt, faPencilAlt } from "@fortawesome/free-solid-svg-icons";
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

export const RelatedObjects = forwardRef<RelatedObjectsHandle, RelatedObjectsProps>(
  function RelatedObjects(
    {
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
    },
    ref
  ) {
    const [objectList, setObjectList] = useState<RelatedObject[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

    const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    );

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

    useImperativeHandle(
      ref,
      () => ({
        refresh: getRelatedObjects,
      }),
      [getRelatedObjects]
    );

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
        setObjectList(prev =>
          prev.map(obj => (obj.uuid === bcObject.uuid ? { ...obj, noteIsEditable: false } : obj))
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
      setObjectList(prev =>
        prev.map(obj => (obj.uuid === uuid ? { ...obj, noteIsEditable: editable } : obj))
      );
      if (editable) {
        setTimeout(() => {
          inputRefs.current[uuid]?.focus();
        }, 50);
      }
    }, []);

    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
          const oldIndex = objectList.findIndex(item => item.uuid === active.id);
          const newIndex = objectList.findIndex(item => item.uuid === over.id);

          const newList = arrayMove(objectList, oldIndex, newIndex);
          setObjectList(newList);

          const newPosition = newIndex + 1;

          doPost(
            sortRelatedObjectsUrl,
            {
              node_uuid: objectUuid,
              object_uuid: active.id as string,
              new_position: newPosition,
              node_type: nodeType,
            },
            () => {}
          );
        }
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
            dropdownSlot={
              <ul className="dropdown-menu-list">
                <li key="new-object">
                  <a
                    className="dropdown-item"
                    href="#"
                    onClick={e => {
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={objectList.map(item => item.uuid)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="list-group list-group-flush interior-borders mb-0">
                {objectList.map((element, index) => (
                  <SortableRelatedObject
                    key={element.uuid}
                    element={element}
                    index={index}
                    inputRefs={inputRefs}
                    handleRemoveObject={handleRemoveObject}
                    handleEditNote={handleEditNote}
                    toggleNoteEditable={toggleNoteEditable}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </Card>
    );
  }
);

export default RelatedObjects;

interface SortableRelatedObjectProps {
  element: RelatedObject;
  index: number;
  inputRefs: React.MutableRefObject<{ [key: string]: HTMLInputElement | null }>;
  handleRemoveObject: (bcObject: RelatedObject) => void;
  handleEditNote: (bcObject: RelatedObject, note: string) => void;
  toggleNoteEditable: (uuid: string, editable: boolean) => void;
}

function SortableRelatedObject({
  element,
  index,
  inputRefs,
  handleRemoveObject,
  handleEditNote,
  toggleNoteEditable,
}: SortableRelatedObjectProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: element.uuid,
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
      el.style.setProperty(
        "--sortable-transform",
        transform ? CSS.Transform.toString(transform) : "none"
      );
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
        <li className="list-group-item list-group-item-secondary px-0">
          <div className="dropdown-height d-flex align-items-start">
            <div className="d-flex flex-column flex-grow-1">
              {element.type === "bookmark" && element.cover_url && (
                <div className="pe-2">
                  <img src={element.cover_url} width="120" height="67" alt="" />
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
                  className="node-object-note text-muted small cursor-pointer"
                  onClick={() => toggleNoteEditable(element.uuid, true)}
                >
                  {element.note}
                </div>
              ) : (
                <div onPointerDown={e => e.stopPropagation()}>
                  <input
                    ref={el => {
                      inputRefs.current[element.uuid] = el;
                    }}
                    type="text"
                    className="form-control form-control-sm"
                    defaultValue={element.note || ""}
                    placeholder=""
                    autoComplete="off"
                    onBlur={e => handleEditNote(element, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        handleEditNote(element, (e.target as HTMLInputElement).value);
                      }
                    }}
                  />
                </div>
              )}
            </div>
            <div className="show-on-hover" onPointerDown={e => e.stopPropagation()}>
              <DropDownMenu
                dropdownSlot={
                  <ul className="dropdown-menu-list">
                    <li key="remove">
                      <a
                        className="dropdown-item"
                        href="#"
                        onClick={e => {
                          e.preventDefault();
                          handleRemoveObject(element);
                        }}
                      >
                        <FontAwesomeIcon icon={faTrashAlt} className="text-primary me-3" />
                        Remove
                      </a>
                    </li>
                    <li key="edit">
                      <a className="dropdown-item" href={element.edit_url}>
                        <FontAwesomeIcon icon={faPencilAlt} className="text-primary me-3" />
                        Edit {element.type}
                      </a>
                    </li>
                    <li key="note">
                      <a
                        className="dropdown-item"
                        href="#"
                        onClick={e => {
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
  );
}
