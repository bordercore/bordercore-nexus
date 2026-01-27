import React from "react";
import { createRoot } from "react-dom/client";
import NodeDetailPage from "../react/node/NodeDetailPage";
import type { Layout, PriorityOption } from "../react/node/types";

const container = document.getElementById("react-root");
if (container) {
  // Read node data from data attributes
  const nodeUuid = container.getAttribute("data-node-uuid") || "";
  const nodeName = container.getAttribute("data-node-name") || "";

  // Read URLs from data attributes
  const urls = {
    nodeList: container.getAttribute("data-node-list-url") || "",
    editNode: container.getAttribute("data-edit-node-url") || "",
    changeLayout: container.getAttribute("data-change-layout-url") || "",
    // Collection URLs
    addCollection: container.getAttribute("data-add-collection-url") || "",
    updateCollection: container.getAttribute("data-update-collection-url") || "",
    deleteCollection: container.getAttribute("data-delete-collection-url") || "",
    collectionDetailTemplate: container.getAttribute("data-collection-detail-template") || "",
    getObjectListTemplate: container.getAttribute("data-get-object-list-template") || "",
    editObjectNoteTemplate: container.getAttribute("data-edit-object-note-template") || "",
    removeObjectTemplate: container.getAttribute("data-remove-object-template") || "",
    sortObjectsTemplate: container.getAttribute("data-sort-objects-template") || "",
    addNewBookmarkTemplate: container.getAttribute("data-add-new-bookmark-template") || "",
    addObjectTemplate: container.getAttribute("data-add-object-template") || "",
    collectionSearchUrl: container.getAttribute("data-collection-search-url") || "",
    // Note URLs
    addNote: container.getAttribute("data-add-note-url") || "",
    deleteNote: container.getAttribute("data-delete-note-url") || "",
    setNoteColor: container.getAttribute("data-set-note-color-url") || "",
    blobDetailTemplate: container.getAttribute("data-blob-detail-template") || "",
    // Todo URLs
    addTodoList: container.getAttribute("data-add-todo-list-url") || "",
    deleteTodoList: container.getAttribute("data-delete-todo-list-url") || "",
    getTodoList: container.getAttribute("data-get-todo-list-url") || "",
    addNodeTodo: container.getAttribute("data-add-node-todo-url") || "",
    sortNodeTodos: container.getAttribute("data-sort-node-todos-url") || "",
    removeNodeTodoTemplate: container.getAttribute("data-remove-node-todo-template") || "",
    createTodo: container.getAttribute("data-create-todo-url") || "",
    editTodoTemplate: container.getAttribute("data-edit-todo-template") || "",
    tagSearch: container.getAttribute("data-tag-search-url") || "",
    // Image URLs
    addImage: container.getAttribute("data-add-image-url") || "",
    // Quote URLs
    addQuote: container.getAttribute("data-add-quote-url") || "",
    updateQuote: container.getAttribute("data-update-quote-url") || "",
    getQuoteTemplate: container.getAttribute("data-get-quote-template") || "",
    getAndSetQuote: container.getAttribute("data-get-and-set-quote-url") || "",
    // Node URLs
    addNode: container.getAttribute("data-add-node-url") || "",
    updateNode: container.getAttribute("data-update-node-url") || "",
    nodeSearch: container.getAttribute("data-node-search-url") || "",
    nodePreviewTemplate: container.getAttribute("data-node-preview-template") || "",
    nodeDetailTemplate: container.getAttribute("data-node-detail-template") || "",
    // Component URLs
    removeComponent: container.getAttribute("data-remove-component-url") || "",
    // Object select
    searchNames: container.getAttribute("data-search-names-url") || "",
  };

  // Parse JSON data from json_script tags
  const layoutEl = document.getElementById("layout-data");
  let layout: Layout = [[], [], []];
  try {
    layout = layoutEl ? JSON.parse(layoutEl.textContent || "[[],[],[]]") : [[], [], []];
  } catch (e) {
    console.error("Error parsing layout:", e);
  }

  const priorityListEl = document.getElementById("priority-list-data");
  let priorityList: PriorityOption[] = [];
  try {
    priorityList = priorityListEl ? JSON.parse(priorityListEl.textContent || "[]") : [];
  } catch (e) {
    console.error("Error parsing priority list:", e);
  }

  const root = createRoot(container);
  root.render(
    <NodeDetailPage
      nodeUuid={nodeUuid}
      initialNodeName={nodeName}
      initialLayout={layout}
      priorityList={priorityList}
      urls={urls}
    />
  );
}
