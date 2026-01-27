import React, { useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPencilAlt,
  faImage,
  faQuoteLeft,
  faTasks,
  faBox,
  faSplotch,
  faStickyNote,
} from "@fortawesome/free-solid-svg-icons";
import { Modal } from "bootstrap";
import cloneDeep from "lodash/cloneDeep";
import { DropDownMenu, DropDownMenuHandle } from "../common/DropDownMenu";
import { doPost } from "../utils/reactUtils";
import { TodoEditor, TodoEditorHandle } from "../todo/TodoEditor";
import { ObjectSelectModal, ObjectSelectModalHandle } from "../common/ObjectSelectModal";
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
  initialLayout: Layout;
  priorityList: PriorityOption[];
  urls: NodeDetailUrls;
}

const UUID_PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

export default function NodeDetailPage({
  nodeUuid,
  initialNodeName,
  initialLayout,
  priorityList,
  urls,
}: NodeDetailPageProps) {
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [nodeName, setNodeName] = useState(initialNodeName);
  const [editLayout, setEditLayout] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [draggingItem, setDraggingItem] = useState<{ col: number; row: number } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ col: number; row: number } | null>(null);

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
  const [objectSelectModalData, setObjectSelectModalData] = useState<{
    callback: (() => void) | null;
    collectionUuid: string;
  } | null>(null);

  // Refs
  const todoEditorRef = useRef<TodoEditorHandle>(null);
  const todoListRefs = useRef<Map<string, NodeTodoListHandle>>(new Map());
  const objectSelectModalRef = useRef<ObjectSelectModalHandle>(null);
  const dropdownMenuRef = useRef<DropDownMenuHandle>(null);

  // Helper function to replace UUID placeholder in URLs
  const replaceUuid = (url: string, uuid: string) =>
    url.replace(UUID_PLACEHOLDER, uuid);

  // Layout change handler
  const handleEditLayout = (newLayoutJson: string) => {
    const newLayout = JSON.parse(newLayoutJson) as Layout;
    setLayout(newLayout);
  };

  // Sync layout to backend
  const syncLayout = (newLayout: Layout) => {
    doPost(
      urls.changeLayout,
      {
        node_uuid: nodeUuid,
        layout: JSON.stringify(newLayout),
      },
      () => {}
    );
  };

  // Drag handlers for layout items
  const handleDragStart = (e: React.DragEvent, colIndex: number, rowIndex: number) => {
    if (!editLayout) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ col: colIndex, row: rowIndex }));
    setDraggingItem({ col: colIndex, row: rowIndex });
  };

  const handleDragOver = (e: React.DragEvent, colIndex: number, rowIndex: number) => {
    if (!editLayout) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget({ col: colIndex, row: rowIndex });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!editLayout) return;
    // Only clear if leaving to outside (not to a child element)
    const relatedTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverTarget(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetCol: number, targetRow: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editLayout || !draggingItem) return;

    const { col: sourceCol, row: sourceRow } = draggingItem;

    // Skip if dropping in the same position
    if (sourceCol === targetCol && (sourceRow === targetRow || sourceRow === targetRow - 1)) {
      setDraggingItem(null);
      setDragOverTarget(null);
      return;
    }

    const newLayout = cloneDeep(layout);
    const [item] = newLayout[sourceCol].splice(sourceRow, 1);

    // Adjust target index when moving down within the same column
    // because removing the source item shifts subsequent indices
    let adjustedTargetRow = targetRow;
    if (sourceCol === targetCol && sourceRow < targetRow) {
      adjustedTargetRow = targetRow - 1;
    }

    newLayout[targetCol].splice(adjustedTargetRow, 0, item);

    setLayout(newLayout);
    syncLayout(newLayout);
    setDraggingItem(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggingItem(null);
    setDragOverTarget(null);
  };

  // Node name editing
  const handleNodeNameSave = () => {
    setIsEditingName(false);
    doPost(
      urls.editNode,
      {
        uuid: nodeUuid,
        name: nodeName,
      },
      () => {},
      "Node name updated"
    );
  };

  // Add new components
  const handleAddCollection = () => {
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
      (response) => {
        handleEditLayout(response.data.layout);
      },
      "Collection added"
    );
  };

  const handleAddNote = () => {
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
      (response) => {
        handleEditLayout(response.data.layout);
      },
      "Note added"
    );
  };

  const handleAddTodoList = () => {
    doPost(
      urls.addTodoList,
      {
        node_uuid: nodeUuid,
      },
      (response) => {
        handleEditLayout(response.data.layout);
      },
      "Todo list added"
    );
  };

  const handleAddImage = () => {
    objectSelectModalRef.current?.open((selectedObject) => {
      doPost(
        urls.addImage,
        {
          node_uuid: nodeUuid,
          image_uuid: selectedObject.uuid,
        },
        (response) => {
          handleEditLayout(response.data.layout);
        },
        "Image added"
      );
    });
  };

  const handleAddQuote = () => {
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
      (response) => {
        handleEditLayout(response.data.layout);
      },
      "Quote added"
    );
  };

  const handleAddNode = () => {
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
      (response) => {
        handleEditLayout(response.data.layout);
      },
      "Node added"
    );
  };

  // TodoEditor integration
  const handleOpenTodoEditorModal = (action: "Create" | "Edit", todoInfo?: NodeTodoItem) => {
    todoEditorRef.current?.openModal(action, todoInfo);
  };

  const handleTodoAdd = (uuid: string) => {
    // Add todo to node and refresh todo list
    todoListRefs.current.forEach((ref) => {
      ref.addNodeTodo(uuid);
    });
  };

  const handleTodoEdit = () => {
    // Refresh todo list after edit
    todoListRefs.current.forEach((ref) => {
      ref.getTodoList();
    });
  };

  // Object select modal handlers
  const handleOpenObjectSelectModal = (
    callback: () => void,
    data: { collectionUuid: string }
  ) => {
    setObjectSelectModalData({ callback, collectionUuid: data.collectionUuid });
    objectSelectModalRef.current?.open((selectedObject) => {
      // Backend expects blob_uuid or bookmark_uuid based on object type
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
    });
  };

  // Render a single layout item
  const renderLayoutItem = (item: LayoutItem, colIndex: number, rowIndex: number) => {
    const key = `${item.type}-${colIndex}-${rowIndex}`;

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
            onOpenImageModal={(imageUrl) =>
              setImageModalState({ isOpen: true, imageUrl })
            }
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
            noteUrl={replaceUuid(urls.blobDetailTemplate, note.uuid)}
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
            ref={(ref) => {
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
            onOpenImageModal={(imageUrl) =>
              setImageModalState({ isOpen: true, imageUrl })
            }
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

  const dropdownContent = (
    <ul className="dropdown-menu-list">
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={(e) => {
            e.preventDefault();
            setIsEditingName(true);
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faPencilAlt} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">Edit node</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={(e) => {
            e.preventDefault();
            handleAddCollection();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faSplotch} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">New collection</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={(e) => {
            e.preventDefault();
            handleAddNote();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faStickyNote} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">New note</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={(e) => {
            e.preventDefault();
            handleAddImage();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faImage} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">New media</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={(e) => {
            e.preventDefault();
            handleAddQuote();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faQuoteLeft} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">New quote</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={(e) => {
            e.preventDefault();
            handleAddTodoList();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faTasks} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">New todo list</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={(e) => {
            e.preventDefault();
            handleAddNode();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faBox} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">New node</span>
        </a>
      </li>
      <li>
        <a
          href="#"
          className="dropdown-menu-item"
          onClick={(e) => {
            e.preventDefault();
            setEditLayout(!editLayout);
            dropdownMenuRef.current?.close();
          }}
        >
          <span className="dropdown-menu-icon">
            <FontAwesomeIcon icon={faPencilAlt} className="text-primary" />
          </span>
          <span className="dropdown-menu-text">
            {editLayout ? "Done editing layout" : "Edit layout"}
          </span>
        </a>
      </li>
    </ul>
  );

  return (
    <div>
      {/* Header row with breadcrumb and dropdown */}
      <div className="d-flex align-items-center mb-gutter px-3">
        <nav aria-label="breadcrumb" className="flex-grow-1">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item">
              <a href={urls.nodeList}>Nodes</a>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              {isEditingName ? (
                <input
                  type="text"
                  className="form-control form-control-sm d-inline-block w-auto"
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  onBlur={handleNodeNameSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNodeNameSave();
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="node-name cursor-pointer"
                  onDoubleClick={() => setIsEditingName(true)}
                >
                  {nodeName}
                </span>
              )}
            </li>
          </ol>
        </nav>
        <span
          className="text-primary me-4 text-nowrap"
          style={{ opacity: editLayout ? 1 : 0 }}
        >
          Edit Layout
        </span>
        <DropDownMenu ref={dropdownMenuRef} dropdownSlot={dropdownContent} />
      </div>

      {/* 3-column layout */}
      <div className="row px-3">
        {layout.map((column, colIndex) => (
          <div
            key={colIndex}
            className={`col-lg-4 ${editLayout ? "edit-layout-mode" : ""}`}
            onDragOver={(e) => handleDragOver(e, colIndex, 0)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, colIndex, 0)}
          >
            {/* Drop indicator at top of column */}
            {dragOverTarget?.col === colIndex && dragOverTarget?.row === 0 && (
              <div className="drop-indicator" />
            )}
            {column.map((item, rowIndex) => (
              <React.Fragment key={`${colIndex}-${rowIndex}`}>
                {/* Drop indicator before this item (when hovering on this item) */}
                {dragOverTarget?.col === colIndex && dragOverTarget?.row === rowIndex && rowIndex > 0 && (
                  <div className="drop-indicator" />
                )}
                <div
                  className={`mb-gutter ${
                    editLayout ? "draggable-item" : ""
                  } ${
                    draggingItem?.col === colIndex && draggingItem?.row === rowIndex
                      ? "dragging"
                      : ""
                  }`}
                  draggable={editLayout}
                  onDragStart={(e) => handleDragStart(e, colIndex, rowIndex)}
                  onDragOver={(e) => handleDragOver(e, colIndex, rowIndex)}
                  onDrop={(e) => handleDrop(e, colIndex, rowIndex)}
                  onDragEnd={handleDragEnd}
                >
                  {renderLayoutItem(item, colIndex, rowIndex)}
                </div>
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>

      {/* Modals */}
      <NodeImageModal
        isOpen={imageModalState.isOpen}
        imageUrl={imageModalState.imageUrl}
        onClose={() => setImageModalState({ isOpen: false, imageUrl: "" })}
      />

      <NodeNoteModal
        isOpen={noteModalState.isOpen}
        action={noteModalState.action}
        data={noteModalState.data}
        onSave={(data) => {
          if (noteModalState.callback) {
            noteModalState.callback(data);
          }
          setNoteModalState((prev) => ({ ...prev, isOpen: false }));
          setNoteColorPreview(null);
        }}
        onColorChange={(color) => {
          if (noteModalState.data?.uuid) {
            setNoteColorPreview({ uuid: noteModalState.data.uuid, color });
          }
        }}
        onClose={() => {
          setNoteModalState((prev) => ({ ...prev, isOpen: false }));
          setNoteColorPreview(null);
        }}
      />

      <NodeQuoteModal
        isOpen={quoteModalState.isOpen}
        action={quoteModalState.action}
        nodeUuid={nodeUuid}
        addQuoteUrl={urls.addQuote}
        data={quoteModalState.data}
        onSave={(options) => {
          if (quoteModalState.callback) {
            quoteModalState.callback(options);
          }
          setQuoteModalState((prev) => ({ ...prev, isOpen: false }));
        }}
        onAddQuote={handleQuoteAdd}
        onClose={() => setQuoteModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      <NodeNodeModal
        isOpen={nodeModalState.isOpen}
        action={nodeModalState.action}
        searchUrl={`${urls.nodeSearch}?query=`}
        data={nodeModalState.data}
        onSave={(options) => {
          if (nodeModalState.callback) {
            nodeModalState.callback(options);
          }
          setNodeModalState((prev) => ({ ...prev, isOpen: false }));
        }}
        onSelectNode={handleNodeSelect}
        onClose={() => setNodeModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      <NodeCollectionModal
        isOpen={collectionModalState.isOpen}
        action={collectionModalState.action}
        searchUrl={urls.collectionSearchUrl}
        data={collectionModalState.data}
        onSave={(settings) => {
          if (collectionModalState.callback) {
            collectionModalState.callback(settings);
          }
          setCollectionModalState((prev) => ({ ...prev, isOpen: false }));
        }}
        onAddCollection={handleCollectionAdd}
        onClose={() => setCollectionModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      <TodoEditor
        ref={todoEditorRef}
        priorityList={priorityList}
        editTodoUrl={urls.editTodoTemplate}
        createTodoUrl={urls.createTodo}
        tagSearchUrl={urls.tagSearch}
        onAdd={handleTodoAdd}
        onEdit={handleTodoEdit}
      />

      <ObjectSelectModal
        ref={objectSelectModalRef}
        searchObjectUrl={urls.searchNames}
      />
    </div>
  );
}
