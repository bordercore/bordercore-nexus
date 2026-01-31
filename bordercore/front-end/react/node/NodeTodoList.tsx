import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef, useLayoutEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTasks,
  faPlus,
  faPencilAlt,
  faTrashAlt,
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
import { doGet, doPost, doDelete } from "../utils/reactUtils";
import type { NodeTodoItem } from "./types";

interface SortableTodoItemProps {
  element: NodeTodoItem;
  onEdit: (todoInfo: NodeTodoItem) => void;
  onRemove: (uuid: string) => void;
}

function SortableTodoItem({ element, onEdit, onRemove }: SortableTodoItemProps) {
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
            <div>
              {element.name}
              {element.url && (
                <div className="node-url">
                  <a href={element.url}>Link</a>
                </div>
              )}
              {element.note && (
                <div className="node-object-note">{element.note}</div>
              )}
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
                          onEdit(element);
                        }}
                      >
                        <span className="dropdown-menu-icon">
                          <FontAwesomeIcon
                            icon={faPencilAlt}
                            className="text-primary"
                          />
                        </span>
                        <span className="dropdown-menu-text">Edit</span>
                      </a>
                    </li>
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
                          <FontAwesomeIcon
                            icon={faTrashAlt}
                            className="text-primary"
                          />
                        </span>
                        <span className="dropdown-menu-text">Remove</span>
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

interface NodeTodoListProps {
  nodeUuid: string;
  getTodoListUrl: string;
  addNodeTodoUrl: string;
  removeNodeTodoUrl: string;
  sortNodeTodosUrl: string;
  deleteTodoListUrl: string;
  onOpenTodoEditorModal: (action: "Create" | "Edit", todoInfo?: NodeTodoItem) => void;
  onEditLayout: (layout: string) => void;
}

export interface NodeTodoListHandle {
  getTodoList: () => void;
  addNodeTodo: (todoUuid: string) => void;
}

const NodeTodoList = forwardRef<NodeTodoListHandle, NodeTodoListProps>(
  function NodeTodoList(
    {
      nodeUuid,
      getTodoListUrl,
      addNodeTodoUrl,
      removeNodeTodoUrl,
      sortNodeTodosUrl,
      deleteTodoListUrl,
      onOpenTodoEditorModal,
      onEditLayout,
    },
    ref
  ) {
    const [todoList, setTodoList] = useState<NodeTodoItem[]>([]);

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
      getTodoList();
    }, []);

    useImperativeHandle(ref, () => ({
      getTodoList,
      addNodeTodo,
    }));

    const getTodoList = () => {
      doGet(
        getTodoListUrl,
        (response) => {
          setTodoList(response.data.todo_list);
        },
        "Error getting todo list"
      );
    };

    const addNodeTodo = (todoUuid: string) => {
      doPost(
        addNodeTodoUrl,
        {
          node_uuid: nodeUuid,
          todo_uuid: todoUuid,
        },
        () => {
          getTodoList();
        }
      );
    };

    const handleTodoCreate = () => {
      onOpenTodoEditorModal("Create");
    };

    const handleTodoEdit = (todoInfo: NodeTodoItem) => {
      onOpenTodoEditorModal("Edit", todoInfo);
    };

    const handleTodoRemove = (todoUuid: string) => {
      const url = removeNodeTodoUrl.replace(
        "00000000-0000-0000-0000-000000000000",
        todoUuid
      );
      doDelete(
        url,
        () => {
          getTodoList();
        },
        "Todo task deleted"
      );
    };

    const handleDeleteTodoList = () => {
      doPost(
        deleteTodoListUrl,
        {
          node_uuid: nodeUuid,
        },
        (response) => {
          onEditLayout(response.data.layout);
        },
        "Todo list deleted"
      );
    };

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = todoList.findIndex((item) => item.uuid === active.id);
        const newIndex = todoList.findIndex((item) => item.uuid === over.id);

        const newList = arrayMove(todoList, oldIndex, newIndex);
        setTodoList(newList);

        // Backend expects 1-indexed position
        const newPosition = newIndex + 1;
        doPost(
          sortNodeTodosUrl,
          {
            node_uuid: nodeUuid,
            todo_uuid: active.id.toString(),
            new_position: newPosition.toString(),
          },
          () => {}
        );
      }
    };

    const headerDropdownContent = (
      <ul className="dropdown-menu-list">
        <li>
          <a
            href="#"
            className="dropdown-menu-item"
            onClick={(e) => {
              e.preventDefault();
              handleTodoCreate();
            }}
          >
            <span className="dropdown-menu-icon">
              <FontAwesomeIcon icon={faPlus} className="text-primary" />
            </span>
            <span className="dropdown-menu-text">Add Task</span>
          </a>
        </li>
        <li>
          <a
            href="#"
            className="dropdown-menu-item"
            onClick={(e) => {
              e.preventDefault();
              handleDeleteTodoList();
            }}
          >
            <span className="dropdown-menu-icon">
              <FontAwesomeIcon icon={faPlus} className="text-primary" />
            </span>
            <span className="dropdown-menu-text">Remove Todo List</span>
          </a>
        </li>
      </ul>
    );

    const titleSlot = (
      <div className="card-title d-flex">
        <div>
          <FontAwesomeIcon icon={faTasks} className="text-primary me-3" />
          Todo Tasks
        </div>
        <div className="dropdown-menu-container ms-auto hover-reveal-content">
          <DropDownMenu
            showOnHover={false}
            dropdownSlot={headerDropdownContent}
          />
        </div>
      </div>
    );

    return (
      <div className="hover-reveal-target">
        <Card
          cardClassName="backdrop-filter node-color-1 position-relative"
          titleSlot={titleSlot}
        >
          <hr className="divider" />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={todoList.map((item) => item.uuid)}
              strategy={verticalListSortingStrategy}
            >
              <ul
                id="sort-container-tags"
                className="list-group list-group-flush interior-borders"
              >
                {todoList.map((element) => (
                  <SortableTodoItem
                    key={element.uuid}
                    element={element}
                    onEdit={handleTodoEdit}
                    onRemove={handleTodoRemove}
                  />
                ))}
                {todoList.length === 0 && (
                  <div className="text-muted">No tasks</div>
                )}
              </ul>
            </SortableContext>
          </DndContext>
        </Card>
      </div>
    );
  }
);

export default NodeTodoList;
