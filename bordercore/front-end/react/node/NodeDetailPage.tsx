import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPencilAlt,
  faImage,
  faQuoteRight,
  faSquareCheck,
  faLayerGroup,
  faStickyNote,
  faNoteSticky,
  faThumbtack,
  faEllipsisVertical,
  faGripVertical,
  faTableCellsLarge,
  faTimes,
  faDiagramProject,
} from "@fortawesome/free-solid-svg-icons";
import cloneDeep from "lodash/cloneDeep";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  defaultAnimateLayoutChanges,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { doPost, doPatch } from "../utils/reactUtils";
import { formatRelative } from "../utils/formatRelative";
import { NewTodoModal } from "../todo/NewTodoModal";
import { EditTodoModal, EditTodoInfo } from "../todo/EditTodoModal";
import { ObjectSelectModal } from "../common/ObjectSelectModal";
import NodeCollectionCard from "./NodeCollectionCard";
import NodeCollectionModal, { CollectionSettings } from "./NodeCollectionModal";
import NodeNote from "./NodeNote";
import NodeNoteModal from "./NodeNoteModal";
import NodeTodoList, { NodeTodoListHandle } from "./NodeTodoList";
import NodeImage from "./NodeImage";
import NodeImageModal from "./NodeImageModal";
import NodeQuote from "./NodeQuote";
import NodeQuoteModal from "./NodeQuoteModal";
import NodeNode from "./NodeNode";
import NodeNodeModal from "./NodeNodeModal";
import EditNodeModal from "./EditNodeModal";
import type {
  Layout,
  LayoutItem,
  CollectionLayoutItem,
  NoteLayoutItem,
  TodoLayoutItem,
  ImageLayoutItem,
  QuoteLayoutItem,
  NodeLayoutItem,
  QuoteOptions,
  NodeOptions,
  NodeColor,
  PriorityOption,
  NodeTodoItem,
} from "./types";

interface NodeDetailUrls {
  nodeList: string;
  editNode: string;
  changeLayout: string;
  addCollection: string;
  updateCollection: string;
  deleteCollection: string;
  collectionDetailTemplate: string;
  getObjectListTemplate: string;
  editObjectNoteTemplate: string;
  removeObjectTemplate: string;
  sortObjectsTemplate: string;
  addNewBookmarkTemplate: string;
  addObjectTemplate: string;
  collectionSearchUrl: string;
  addNote: string;
  deleteNote: string;
  setNoteColor: string;
  blobDetailTemplate: string;
  blobApiTemplate: string;
  addTodoList: string;
  deleteTodoList: string;
  getTodoList: string;
  addNodeTodo: string;
  sortNodeTodos: string;
  removeNodeTodoTemplate: string;
  createTodo: string;
  editTodoTemplate: string;
  tagSearch: string;
  addImage: string;
  addQuote: string;
  updateQuote: string;
  getQuoteTemplate: string;
  getAndSetQuote: string;
  addNode: string;
  updateNode: string;
  nodeSearch: string;
  nodePreviewTemplate: string;
  nodeDetailTemplate: string;
  removeComponent: string;
  searchNames: string;
}

interface NodeDetailPageProps {
  nodeUuid: string;
  initialNodeName: string;
  initialIsPinned: boolean;
  initialNote: string;
  modifiedAt: string;
  createdAt: string;
  initialLayout: Layout;
  priorityList: PriorityOption[];
  urls: NodeDetailUrls;
}

const UUID_PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

function getLayoutItemKey(item: LayoutItem): string {
  if (item.type === "todo") return "todo";
  return (item as { uuid: string }).uuid;
}

function findItemPosition(layout: Layout, id: string): [number, number] | null {
  for (let col = 0; col < layout.length; col++) {
    for (let row = 0; row < layout[col].length; row++) {
      if (getLayoutItemKey(layout[col][row]) === id) return [col, row];
    }
  }
  return null;
}

function formatAbsolute(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
    .toLowerCase();
}

export default function NodeDetailPage({
  nodeUuid,
  initialNodeName,
  initialIsPinned,
  initialNote,
  modifiedAt,
  createdAt,
  initialLayout,
  priorityList,
  urls,
}: NodeDetailPageProps) {
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [nodeName, setNodeName] = useState(initialNodeName);
  const [isPinned, setIsPinned] = useState(initialIsPinned);
  const [nodeNote, setNodeNote] = useState(initialNote);
  const [editLayout, setEditLayout] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  // Dismiss open popovers when clicking outside
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showAddMenu && !showActionsMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (!headerRef.current) return;
      if (headerRef.current.contains(e.target as Node)) return;
      setShowAddMenu(false);
      setShowActionsMenu(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showAddMenu, showActionsMenu]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Modal states
  const [imageModalState, setImageModalState] = useState({ isOpen: false, imageUrl: "" });
  const [noteModalState, setNoteModalState] = useState<{
    isOpen: boolean;
    action: "Add" | "Edit";
    callback: ((data: { name: string; color: NodeColor }) => void) | null;
    data: { name: string; color: NodeColor; uuid: string } | null;
  }>({ isOpen: false, action: "Add", callback: null, data: null });
  const [noteColorPreview, setNoteColorPreview] = useState<{
    uuid: string;
    color: NodeColor;
  } | null>(null);
  const [quoteModalState, setQuoteModalState] = useState<{
    isOpen: boolean;
    action: "Add" | "Edit";
    callback: ((options: QuoteOptions) => void) | null;
    data: QuoteOptions | null;
  }>({ isOpen: false, action: "Add", callback: null, data: null });
  const [nodeModalState, setNodeModalState] = useState<{
    isOpen: boolean;
    action: "Add" | "Edit";
    callback: ((options: NodeOptions) => void) | null;
    data: NodeOptions | null;
  }>({ isOpen: false, action: "Add", callback: null, data: null });
  const [collectionModalState, setCollectionModalState] = useState<{
    isOpen: boolean;
    action: "Add" | "Edit";
    callback: ((settings: CollectionSettings) => void) | null;
    data: CollectionSettings | null;
  }>({ isOpen: false, action: "Add", callback: null, data: null });

  // Todo modal state (replaces the old TodoEditor imperative ref)
  const [newTodoOpen, setNewTodoOpen] = useState(false);
  const [editTodo, setEditTodo] = useState<EditTodoInfo | null>(null);

  // Refs
  const todoListRefs = useRef<Map<string, NodeTodoListHandle>>(new Map());
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ObjectSelectModal state (declarative refined-modal API)
  const [objectSelectOpen, setObjectSelectOpen] = useState(false);
  const objectSelectHandlerRef = useRef<
    ((object: { uuid: string; doctype?: string }) => void) | null
  >(null);
  const handleObjectSelected = useCallback((selectedObject: { uuid: string; doctype?: string }) => {
    objectSelectHandlerRef.current?.(selectedObject);
  }, []);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const replaceUuid = (url: string, uuid: string) => url.replace(UUID_PLACEHOLDER, uuid);

  // Live stats from layout
  const stats = useMemo(() => {
    const flat = layout.flat();
    return {
      total: flat.length,
      collections: flat.filter(i => i.type === "collection").length,
      images: flat.filter(i => i.type === "image").length,
      notes: flat.filter(i => i.type === "note").length,
      todos: flat.filter(i => i.type === "todo").length,
      quotes: flat.filter(i => i.type === "quote").length,
      nodes: flat.filter(i => i.type === "node").length,
    };
  }, [layout]);

  // Layout handlers
  const handleEditLayout = (newLayoutJson: string) => {
    const newLayout = JSON.parse(newLayoutJson) as Layout;
    setLayout(newLayout);
  };

  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const dragOverlayNodeRef = useRef<Node | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const syncLayout = useCallback(
    (newLayout: Layout) => {
      doPost(
        urls.changeLayout,
        {
          node_uuid: nodeUuid,
          layout: JSON.stringify(newLayout),
        },
        () => {}
      );
    },
    [urls.changeLayout, nodeUuid]
  );

  const handleLayoutDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveLayoutId(id);
    const el = document.querySelector(`[data-layout-item-id="${id}"]`);
    dragOverlayNodeRef.current = el ? el.cloneNode(true) : null;
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    setLayout(prev => {
      const activePos = findItemPosition(prev, activeId);
      if (!activePos) return prev;

      if (overId.startsWith("column-")) {
        const targetCol = parseInt(overId.split("-")[1]);
        if (activePos[0] === targetCol) return prev;
        const newLayout = cloneDeep(prev);
        const [item] = newLayout[activePos[0]].splice(activePos[1], 1);
        newLayout[targetCol].push(item);
        return newLayout;
      }

      const overPos = findItemPosition(prev, overId);
      if (!overPos) return prev;
      if (activePos[0] === overPos[0]) return prev;

      const newLayout = cloneDeep(prev);
      const [item] = newLayout[activePos[0]].splice(activePos[1], 1);
      newLayout[overPos[0]].splice(overPos[1], 0, item);
      return newLayout;
    });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveLayoutId(null);
      const { active, over } = event;

      if (!over || active.id === over.id) {
        syncLayout(layoutRef.current);
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      if (overId.startsWith("column-")) {
        syncLayout(layoutRef.current);
        return;
      }

      const currentLayout = layoutRef.current;
      const activePos = findItemPosition(currentLayout, activeId);
      const overPos = findItemPosition(currentLayout, overId);

      if (!activePos || !overPos) {
        syncLayout(currentLayout);
        return;
      }

      const [activeCol, activeRow] = activePos;
      const [overCol, overRow] = overPos;

      if (activeCol === overCol && activeRow !== overRow) {
        const newLayout = cloneDeep(currentLayout);
        newLayout[activeCol] = arrayMove(newLayout[activeCol], activeRow, overRow);
        setLayout(newLayout);
        syncLayout(newLayout);
      } else {
        syncLayout(currentLayout);
      }
    },
    [syncLayout]
  );

  // Node name editing (inline)
  const handleNodeNameSave = () => {
    setIsEditingName(false);
    if (nodeName === initialNodeName) return;
    doPatch(urls.editNode, { name: nodeName }, () => {}, "Node renamed");
  };

  const handleNodeNameCancel = () => {
    setNodeName(initialNodeName);
    setIsEditingName(false);
  };

  const handleEditNodeSave = (nextName: string, nextNote: string) => {
    const patch: Record<string, string> = {};
    if (nextName !== nodeName) {
      patch.name = nextName;
      setNodeName(nextName);
    }
    if (nextNote !== nodeNote) {
      patch.note = nextNote;
      setNodeNote(nextNote);
    }
    setEditModalOpen(false);
    if (Object.keys(patch).length === 0) return;
    doPatch(urls.editNode, patch, () => {}, "Node updated");
  };

  const handleTogglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    setShowActionsMenu(false);
    doPatch(
      urls.editNode,
      { is_pinned: next ? "true" : "false" },
      () => {},
      next ? "Pinned to home" : "Unpinned"
    );
  };

  // Add component handlers
  const handleAddCollection = () => {
    setShowAddMenu(false);
    setCollectionModalState({
      isOpen: true,
      action: "Add",
      callback: null,
      data: {
        name: "New Collection",
        collection_type: "ad-hoc",
        display: "list",
        rotate: -1,
        random_order: false,
        limit: null,
      },
    });
  };

  const handleCollectionAdd = (settings: CollectionSettings) => {
    doPost(
      urls.addCollection,
      {
        node_uuid: nodeUuid,
        collection_name: settings.name,
        collection_uuid: settings.uuid || "",
        display: settings.display,
        random_order: settings.random_order ? "true" : "false",
        rotate: settings.rotate.toString(),
        limit: settings.limit?.toString() || "",
      },
      response => {
        handleEditLayout(response.data.layout);
      },
      "Collection added"
    );
  };

  const handleAddNote = () => {
    setShowAddMenu(false);
    setNoteModalState({
      isOpen: true,
      action: "Add",
      callback: handleNoteAdd,
      data: { name: "New Note", color: 1, uuid: "" },
    });
  };

  const handleNoteAdd = (data: { name: string; color: NodeColor }) => {
    doPost(
      urls.addNote,
      {
        node_uuid: nodeUuid,
        note_name: data.name,
        color: data.color.toString(),
      },
      response => {
        handleEditLayout(response.data.layout);
      },
      "Note added"
    );
  };

  const handleAddTodoList = () => {
    setShowAddMenu(false);
    doPost(
      urls.addTodoList,
      { node_uuid: nodeUuid },
      response => {
        handleEditLayout(response.data.layout);
      },
      "Todo list added"
    );
  };

  const handleAddImage = () => {
    setShowAddMenu(false);
    objectSelectHandlerRef.current = selectedObject => {
      doPost(
        urls.addImage,
        {
          node_uuid: nodeUuid,
          image_uuid: selectedObject.uuid,
        },
        response => {
          handleEditLayout(response.data.layout);
        },
        "Image added"
      );
    };
    setObjectSelectOpen(true);
  };

  const handleAddQuote = () => {
    setShowAddMenu(false);
    setQuoteModalState({
      isOpen: true,
      action: "Add",
      callback: null,
      data: {
        color: 1,
        rotate: -1,
        format: "standard",
        favorites_only: false,
      },
    });
  };

  const handleQuoteAdd = (options: QuoteOptions) => {
    doPost(
      urls.addQuote,
      {
        node_uuid: nodeUuid,
        options: JSON.stringify(options),
      },
      response => {
        handleEditLayout(response.data.layout);
      },
      "Quote added"
    );
  };

  const handleAddNode = () => {
    setShowAddMenu(false);
    setNodeModalState({
      isOpen: true,
      action: "Add",
      callback: null,
      data: { rotate: -1 },
    });
  };

  const handleNodeSelect = (selectedNodeUuid: string, options: NodeOptions) => {
    doPost(
      urls.addNode,
      {
        parent_node_uuid: nodeUuid,
        node_uuid: selectedNodeUuid,
        options: JSON.stringify(options),
      },
      response => {
        handleEditLayout(response.data.layout);
      },
      "Node added"
    );
  };

  // Todo modal dispatch — NodeTodoList still calls a single callback, we route
  // to the right modal based on action.
  const handleOpenTodoEditorModal = (action: "Create" | "Edit", todoInfo?: NodeTodoItem) => {
    if (action === "Create") {
      setNewTodoOpen(true);
    } else if (todoInfo) {
      setEditTodo({
        uuid: todoInfo.uuid,
        name: todoInfo.name,
        note: todoInfo.note,
        priority: todoInfo.priority,
        url: todoInfo.url,
      });
    }
  };

  const handleTodoAdd = (uuid: string) => {
    todoListRefs.current.forEach(ref => {
      ref.addNodeTodo(uuid);
    });
  };

  const handleTodoEdit = () => {
    todoListRefs.current.forEach(ref => {
      ref.getTodoList();
    });
  };

  const handleOpenObjectSelectModal = (callback: () => void, data: { collectionUuid: string }) => {
    objectSelectHandlerRef.current = selectedObject => {
      const doctype = (selectedObject.doctype || "").toLowerCase();
      const postData: Record<string, string> = {
        collection_uuid: data.collectionUuid,
      };
      if (doctype === "bookmark") {
        postData.bookmark_uuid = selectedObject.uuid;
      } else {
        postData.blob_uuid = selectedObject.uuid;
      }
      doPost(
        replaceUuid(urls.addObjectTemplate, data.collectionUuid),
        postData,
        () => {
          callback();
        },
        "Object added"
      );
    };
    setObjectSelectOpen(true);
  };

  // Render a single layout item body
  const renderLayoutItem = (item: LayoutItem) => {
    const key = getLayoutItemKey(item);

    switch (item.type) {
      case "collection": {
        const coll = item as CollectionLayoutItem;
        return (
          <NodeCollectionCard
            key={key}
            nodeUuid={nodeUuid}
            collectionInitial={coll}
            addNewBookmarkUrl={replaceUuid(urls.addNewBookmarkTemplate, coll.uuid)}
            collectionDetailUrl={replaceUuid(urls.collectionDetailTemplate, coll.uuid)}
            editCollectionUrl={urls.updateCollection}
            getObjectListUrl={replaceUuid(urls.getObjectListTemplate, coll.uuid)}
            editObjectNoteUrl={replaceUuid(urls.editObjectNoteTemplate, coll.uuid)}
            removeObjectUrl={replaceUuid(urls.removeObjectTemplate, coll.uuid)}
            sortObjectsUrl={replaceUuid(urls.sortObjectsTemplate, coll.uuid)}
            deleteCollectionUrl={urls.deleteCollection}
            onOpenCollectionEditModal={(callback, data) =>
              setCollectionModalState({
                isOpen: true,
                action: "Edit",
                callback,
                data,
              })
            }
            onOpenObjectSelectModal={handleOpenObjectSelectModal}
            onOpenImageModal={imageUrl => setImageModalState({ isOpen: true, imageUrl })}
            onEditLayout={handleEditLayout}
          />
        );
      }

      case "note": {
        const note = item as NoteLayoutItem;
        return (
          <NodeNote
            key={key}
            nodeUuid={nodeUuid}
            noteInitial={note}
            noteUrl={replaceUuid(urls.blobApiTemplate, note.uuid)}
            setNoteColorUrl={urls.setNoteColor}
            deleteNoteUrl={urls.deleteNote}
            colorPreview={noteColorPreview?.uuid === note.uuid ? noteColorPreview.color : undefined}
            onOpenNoteMetadataModal={(callback, data) =>
              setNoteModalState({
                isOpen: true,
                action: "Edit",
                callback,
                data,
              })
            }
            onEditLayout={handleEditLayout}
          />
        );
      }

      case "todo": {
        return (
          <NodeTodoList
            key={key}
            ref={ref => {
              if (ref) todoListRefs.current.set(key, ref);
            }}
            nodeUuid={nodeUuid}
            getTodoListUrl={urls.getTodoList}
            addNodeTodoUrl={urls.addNodeTodo}
            removeNodeTodoUrl={urls.removeNodeTodoTemplate}
            sortNodeTodosUrl={urls.sortNodeTodos}
            deleteTodoListUrl={urls.deleteTodoList}
            onOpenTodoEditorModal={handleOpenTodoEditorModal}
            onEditLayout={handleEditLayout}
          />
        );
      }

      case "image": {
        const img = item as ImageLayoutItem;
        return (
          <NodeImage
            key={key}
            uuid={img.uuid}
            nodeUuid={nodeUuid}
            imageTitle={img.image_title}
            imageUrl={img.image_url}
            imageDetailUrl={replaceUuid(urls.blobDetailTemplate, img.image_uuid)}
            removeComponentUrl={urls.removeComponent}
            onOpenImageModal={imageUrl => setImageModalState({ isOpen: true, imageUrl })}
            onEditLayout={handleEditLayout}
          />
        );
      }

      case "quote": {
        const quote = item as QuoteLayoutItem;
        return (
          <NodeQuote
            key={key}
            uuid={quote.uuid}
            nodeUuid={nodeUuid}
            quoteOptionsInitial={quote.options}
            getQuoteUrl={replaceUuid(urls.getQuoteTemplate, quote.quote_uuid)}
            getAndSetQuoteUrl={urls.getAndSetQuote}
            removeComponentUrl={urls.removeComponent}
            editQuoteUrl={urls.updateQuote}
            onOpenQuoteEditModal={(callback, data) =>
              setQuoteModalState({
                isOpen: true,
                action: "Edit",
                callback,
                data,
              })
            }
            onEditLayout={handleEditLayout}
          />
        );
      }

      case "node": {
        const node = item as NodeLayoutItem;
        return (
          <NodeNode
            key={key}
            uuid={node.uuid}
            parentNodeUuid={nodeUuid}
            nodeOptionsInitial={node.options}
            getNodeInfoUrl={replaceUuid(urls.nodePreviewTemplate, node.node_uuid)}
            nodeDetailUrl={replaceUuid(urls.nodeDetailTemplate, node.node_uuid)}
            removeComponentUrl={urls.removeComponent}
            editNodeUrl={urls.updateNode}
            onOpenNodeModal={(callback, data) =>
              setNodeModalState({
                isOpen: true,
                action: "Edit",
                callback,
                data,
              })
            }
            onEditLayout={handleEditLayout}
          />
        );
      }

      default:
        return null;
    }
  };

  const addMenuItems: Array<{
    key: string;
    icon: typeof faLayerGroup;
    label: string;
    hint: string;
    onClick: () => void;
  }> = [
    {
      key: "collection",
      icon: faLayerGroup,
      label: "Collection",
      hint: "images, bookmarks, or notes",
      onClick: handleAddCollection,
    },
    {
      key: "note",
      icon: faNoteSticky,
      label: "Note",
      hint: "freeform markdown",
      onClick: handleAddNote,
    },
    {
      key: "image",
      icon: faImage,
      label: "Image",
      hint: "single blob reference",
      onClick: handleAddImage,
    },
    {
      key: "todo",
      icon: faSquareCheck,
      label: "Todo list",
      hint: "sortable checklist",
      onClick: handleAddTodoList,
    },
    {
      key: "quote",
      icon: faQuoteRight,
      label: "Quote",
      hint: "random from favorites",
      onClick: handleAddQuote,
    },
    {
      key: "node",
      icon: faDiagramProject,
      label: "Node ref",
      hint: "embed another node",
      onClick: handleAddNode,
    },
  ];

  const relModified = formatRelative(modifiedAt);
  const absCreated = formatAbsolute(createdAt);

  return (
    <div className="node-detail-app">
      <main className="nd-page">
        <header className="nd-head" ref={headerRef}>
          <div className="nd-title-row">
            <div className="nd-title-col">
              <h1 className="nd-h1">
                {isEditingName ? (
                  <input
                    ref={nameInputRef}
                    className="nd-name-input"
                    value={nodeName}
                    onChange={e => setNodeName(e.target.value)}
                    onBlur={handleNodeNameSave}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleNodeNameSave();
                      if (e.key === "Escape") handleNodeNameCancel();
                    }}
                  />
                ) : (
                  <span
                    className="nd-name"
                    onDoubleClick={() => setIsEditingName(true)}
                    title="Double-click to rename"
                  >
                    {nodeName}
                  </span>
                )}
              </h1>
            </div>

            <div className="nd-head-actions">
              <div className="nd-add-wrap">
                <button
                  type="button"
                  className="refined-btn primary"
                  onClick={() => {
                    setShowAddMenu(v => !v);
                    setShowActionsMenu(false);
                  }}
                  aria-haspopup="true"
                  aria-expanded={showAddMenu}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  add
                </button>
                {showAddMenu && (
                  <div className="nd-menu" role="menu">
                    {addMenuItems.map(m => (
                      <button key={m.key} type="button" role="menuitem" onClick={m.onClick}>
                        <FontAwesomeIcon icon={m.icon} />
                        <span>{m.label}</span>
                        <span className="hint">{m.hint}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="nd-add-wrap">
                <button
                  type="button"
                  className="refined-btn ghost icon"
                  onClick={() => {
                    setShowActionsMenu(v => !v);
                    setShowAddMenu(false);
                  }}
                  aria-haspopup="true"
                  aria-expanded={showActionsMenu}
                  aria-label="Node actions"
                >
                  <FontAwesomeIcon icon={faEllipsisVertical} />
                </button>
                {showActionsMenu && (
                  <div className="nd-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowActionsMenu(false);
                        setEditModalOpen(true);
                      }}
                    >
                      <FontAwesomeIcon icon={faPencilAlt} />
                      <span>Edit node</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEditLayout(v => !v);
                        setShowActionsMenu(false);
                        flash(editLayout ? "Layout locked" : "Layout unlocked");
                      }}
                    >
                      <FontAwesomeIcon icon={faTableCellsLarge} />
                      <span>{editLayout ? "Lock layout" : "Edit layout"}</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowActionsMenu(false);
                        handleTogglePin();
                      }}
                    >
                      <FontAwesomeIcon icon={faThumbtack} />
                      <span>{isPinned ? "Unpin node" : "Pin node"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="nd-meta-row">
            <span className="nd-chip primary">
              <span className="dot" />
              {stats.total} component{stats.total === 1 ? "" : "s"}
            </span>
            <span className="nd-chip">
              <FontAwesomeIcon icon={faLayerGroup} /> {stats.collections} collections
            </span>
            <span className="nd-chip">
              <FontAwesomeIcon icon={faImage} /> {stats.images} images
            </span>
            <span className="nd-chip">
              <FontAwesomeIcon icon={faStickyNote} /> {stats.notes} notes
            </span>
            <span className="nd-chip">
              <FontAwesomeIcon icon={faSquareCheck} /> {stats.todos} todo lists
            </span>
            {stats.quotes > 0 && (
              <span className="nd-chip">
                <FontAwesomeIcon icon={faQuoteRight} /> {stats.quotes} quotes
              </span>
            )}
            {stats.nodes > 0 && (
              <span className="nd-chip">
                <FontAwesomeIcon icon={faDiagramProject} /> {stats.nodes} linked
              </span>
            )}
            <span className="nd-meta-times">
              {relModified && `modified ${relModified}`}
              {absCreated && ` · created ${absCreated}`}
              {editLayout && " · edit mode"}
            </span>
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleLayoutDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="nd-grid">
            {layout.map((column, colIndex) => (
              <DroppableColumn
                key={colIndex}
                colId={`column-${colIndex}`}
                editLayout={editLayout}
                empty={column.length === 0}
              >
                <SortableContext
                  items={column.map(item => getLayoutItemKey(item))}
                  strategy={verticalListSortingStrategy}
                >
                  {column.map(item => (
                    <SortableLayoutItem
                      key={getLayoutItemKey(item)}
                      id={getLayoutItemKey(item)}
                      itemType={item.type}
                      editLayout={editLayout}
                    >
                      {renderLayoutItem(item)}
                    </SortableLayoutItem>
                  ))}
                </SortableContext>
              </DroppableColumn>
            ))}
          </div>
          <DragOverlay>
            {activeLayoutId ? <LayoutDragOverlay nodeRef={dragOverlayNodeRef} /> : null}
          </DragOverlay>
        </DndContext>

        {/* Modals */}
        <NodeImageModal
          isOpen={imageModalState.isOpen}
          imageUrl={imageModalState.imageUrl}
          onClose={() => setImageModalState({ isOpen: false, imageUrl: "" })}
        />

        <NodeNoteModal
          open={noteModalState.isOpen}
          action={noteModalState.action}
          data={noteModalState.data}
          onSave={data => {
            if (noteModalState.callback) {
              noteModalState.callback(data);
            }
            setNoteModalState(prev => ({ ...prev, isOpen: false }));
            setNoteColorPreview(null);
          }}
          onColorChange={color => {
            if (noteModalState.data?.uuid) {
              setNoteColorPreview({ uuid: noteModalState.data.uuid, color });
            }
          }}
          onClose={() => {
            setNoteModalState(prev => ({ ...prev, isOpen: false }));
            setNoteColorPreview(null);
          }}
        />

        <NodeQuoteModal
          isOpen={quoteModalState.isOpen}
          action={quoteModalState.action}
          nodeUuid={nodeUuid}
          addQuoteUrl={urls.addQuote}
          data={quoteModalState.data}
          onSave={options => {
            if (quoteModalState.callback) {
              quoteModalState.callback(options);
            }
            setQuoteModalState(prev => ({ ...prev, isOpen: false }));
          }}
          onAddQuote={handleQuoteAdd}
          onClose={() => setQuoteModalState(prev => ({ ...prev, isOpen: false }))}
        />

        <NodeNodeModal
          isOpen={nodeModalState.isOpen}
          action={nodeModalState.action}
          searchUrl={`${urls.nodeSearch}?query=`}
          data={nodeModalState.data}
          onSave={options => {
            if (nodeModalState.callback) {
              nodeModalState.callback(options);
            }
            setNodeModalState(prev => ({ ...prev, isOpen: false }));
          }}
          onSelectNode={handleNodeSelect}
          onClose={() => setNodeModalState(prev => ({ ...prev, isOpen: false }))}
        />

        <NodeCollectionModal
          isOpen={collectionModalState.isOpen}
          action={collectionModalState.action}
          searchUrl={urls.collectionSearchUrl}
          data={collectionModalState.data}
          onSave={settings => {
            if (collectionModalState.callback) {
              collectionModalState.callback(settings);
            }
            setCollectionModalState(prev => ({ ...prev, isOpen: false }));
          }}
          onAddCollection={handleCollectionAdd}
          onClose={() => setCollectionModalState(prev => ({ ...prev, isOpen: false }))}
        />

        <NewTodoModal
          open={newTodoOpen}
          onClose={() => setNewTodoOpen(false)}
          createTodoUrl={urls.createTodo}
          tagSearchUrl={urls.tagSearch}
          priorityList={priorityList}
          onAdd={handleTodoAdd}
        />

        <EditTodoModal
          open={editTodo !== null}
          onClose={() => setEditTodo(null)}
          editTodoUrl={urls.editTodoTemplate}
          tagSearchUrl={urls.tagSearch}
          priorityList={priorityList}
          todoInfo={editTodo}
          onEdit={handleTodoEdit}
        />

        <ObjectSelectModal
          open={objectSelectOpen}
          onClose={() => {
            setObjectSelectOpen(false);
            objectSelectHandlerRef.current = null;
          }}
          searchObjectUrl={urls.searchNames}
          onSelectObject={handleObjectSelected}
        />

        <EditNodeModal
          open={editModalOpen}
          initialName={nodeName}
          initialNote={nodeNote}
          onClose={() => setEditModalOpen(false)}
          onSave={handleEditNodeSave}
        />
      </main>

      {toast && (
        <div className="nd-toast" role="status">
          <span className="ok">✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}

const animateLayoutChanges: AnimateLayoutChanges = args => {
  const { wasDragging } = args;
  if (wasDragging) return false;
  return defaultAnimateLayoutChanges(args);
};

interface SortableLayoutItemProps {
  id: string;
  itemType: LayoutItem["type"];
  editLayout: boolean;
  children: React.ReactNode;
}

function SortableLayoutItem({ id, itemType, editLayout, children }: SortableLayoutItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editLayout,
    animateLayoutChanges,
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
        CSS.Transform.toString(transform ? { ...transform, scaleX: 1, scaleY: 1 } : null) ?? "none"
      );
      el.style.setProperty("--sortable-transition", transition ?? "none");
    }
  }, [transform, transition]);

  return (
    <div
      ref={refCallback}
      data-layout-item-id={id}
      data-type={itemType}
      className={`nd-item sortable-layout-item ${editLayout ? "draggable-item" : ""} ${
        isDragging ? "dragging opacity-0" : ""
      }`}
      {...(editLayout ? { ...attributes, ...listeners } : {})}
    >
      {editLayout && (
        <span className="nd-grip" aria-hidden="true" title="Drag to reorder">
          <FontAwesomeIcon icon={faGripVertical} />
        </span>
      )}
      {children}
    </div>
  );
}

interface DroppableColumnProps {
  colId: string;
  editLayout: boolean;
  empty: boolean;
  children: React.ReactNode;
}

function DroppableColumn({ colId, editLayout, empty, children }: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({ id: colId });
  return (
    <div
      ref={setNodeRef}
      className={`nd-col ${editLayout ? "edit-layout-mode" : ""} ${empty ? "empty" : ""}`}
    >
      {empty ? "// drop here" : children}
    </div>
  );
}

function LayoutDragOverlay({ nodeRef }: { nodeRef: React.RefObject<Node | null> }) {
  const containerRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el && nodeRef.current) {
        el.appendChild(nodeRef.current);
      }
    },
    [nodeRef]
  );
  return <div className="layout-drag-overlay" ref={containerRef} />;
}
