import React from "react";
import { createRoot } from "react-dom/client";
import BookshelfPage from "../react/blob/BookshelfPage";
import type { Book, BookshelfTag } from "../react/blob/types";

const container = document.getElementById("react-root");
if (container) {
  // Get data from data attributes
  const totalCount = parseInt(container.getAttribute("data-total-count") || "0", 10);
  const searchTerm = container.getAttribute("data-search-term") || null;
  const selectedTag = container.getAttribute("data-selected-tag") || null;
  const clearUrl = container.getAttribute("data-clear-url") || "";

  // Parse books from JSON script tag
  let books: Book[] = [];
  const booksScript = document.getElementById("books");
  if (booksScript) {
    try {
      books = JSON.parse(booksScript.textContent || "[]");
    } catch (e) {
      console.error("Error parsing books:", e);
    }
  }

  // Parse tag list from JSON script tag
  let tagList: BookshelfTag[] = [];
  const tagListScript = document.getElementById("tag_list");
  if (tagListScript) {
    try {
      tagList = JSON.parse(tagListScript.textContent || "[]");
    } catch (e) {
      console.error("Error parsing tag list:", e);
    }
  }

  const root = createRoot(container);
  root.render(
    <BookshelfPage
      books={books}
      tagList={tagList}
      totalCount={totalCount}
      searchTerm={searchTerm}
      selectedTag={selectedTag}
      clearUrl={clearUrl}
    />
  );
}
