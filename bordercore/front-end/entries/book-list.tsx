import React from "react";
import { createRoot } from "react-dom/client";
import { BookListPage } from "../react/book/BookListPage";

document.addEventListener("DOMContentLoaded", () => {
  const rootElement = document.getElementById("react-root");
  if (!rootElement) return;

  // Parse books data from JSON script
  const booksEl = document.getElementById("books-data");
  const books = booksEl ? JSON.parse(booksEl.textContent || "[]") : [];

  // Parse alphabet from JSON script
  const alphabetEl = document.getElementById("alphabet-data");
  const alphabet = alphabetEl ? JSON.parse(alphabetEl.textContent || "[]") : [];

  const props = {
    books,
    alphabet,
    selectedLetter: rootElement.dataset.selectedLetter || "A",
    baseUrl: rootElement.dataset.baseUrl || "/book/list/",
  };

  const root = createRoot(rootElement);
  root.render(<BookListPage {...props} />);
});
