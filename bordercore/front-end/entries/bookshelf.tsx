import React from "react";
import { createRoot } from "react-dom/client";
import BookshelfPage from "../react/blob/BookshelfPage";
import type {
  Book,
  BookshelfCategory,
  BookshelfTag,
  RecentBook,
  SelectedTagMeta,
} from "../react/blob/types";

function readJsonScript<T>(id: string, fallback: T): T {
  const el = document.getElementById(id);
  if (!el) return fallback;
  try {
    return JSON.parse(el.textContent || "null") ?? fallback;
  } catch (e) {
    console.error(`Error parsing ${id}:`, e);
    return fallback;
  }
}

const container = document.getElementById("react-root");
if (container) {
  const totalCount = parseInt(container.getAttribute("data-total-count") || "0", 10);
  const searchTerm = container.getAttribute("data-search-term") || null;
  const selectedTag = container.getAttribute("data-selected-tag") || null;
  const clearUrl = container.getAttribute("data-clear-url") || "";
  const bookshelfUrl = container.getAttribute("data-bookshelf-url") || clearUrl;

  const books = readJsonScript<Book[]>("books", []);
  const tagList = readJsonScript<BookshelfTag[]>("tag_list", []);
  const categories = readJsonScript<BookshelfCategory[]>("categories", []);
  const recentBooks = readJsonScript<RecentBook[]>("recent_books", []);
  const selectedTagMeta = readJsonScript<SelectedTagMeta | null>(
    "selected_tag_meta",
    null,
  );

  const root = createRoot(container);
  root.render(
    <BookshelfPage
      books={books}
      tagList={tagList}
      categories={categories}
      recentBooks={recentBooks}
      selectedTagMeta={selectedTagMeta}
      totalCount={totalCount}
      searchTerm={searchTerm || null}
      selectedTag={selectedTag || null}
      clearUrl={clearUrl}
      bookshelfUrl={bookshelfUrl}
    />,
  );
}
