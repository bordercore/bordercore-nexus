import React, { useState, useMemo } from "react";

interface Book {
  title: string;
  author: string;
  year: number | null;
}

interface BookListPageProps {
  books: Book[];
  alphabet: string[];
  selectedLetter: string;
  baseUrl: string;
}

type SortField = "title" | "author" | "year";
type SortDirection = "asc" | "desc";

export function BookListPage({
  books,
  alphabet,
  selectedLetter,
  baseUrl,
}: BookListPageProps) {
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filter, setFilter] = useState("");

  const filteredAndSortedBooks = useMemo(() => {
    let result = [...books];

    // Filter
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      result = result.filter(
        (book) =>
          book.title.toLowerCase().includes(lowerFilter) ||
          book.author.toLowerCase().includes(lowerFilter) ||
          (book.year && book.year.toString().includes(lowerFilter))
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle nulls
      if (aVal === null) aVal = "";
      if (bVal === null) bVal = "";

      // Convert to string for comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [books, filter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  return (
    <div className="book-list-page">
      {/* Alphabet Navigation */}
      <ul className="nav nav-pills mb-3">
        {alphabet.map((letter) => (
          <li key={letter} className={letter === selectedLetter ? "active" : ""}>
            <a
              href={`${baseUrl}${letter}`}
              className={`nav-link ${letter === selectedLetter ? "active" : ""}`}
            >
              {letter}
            </a>
          </li>
        ))}
      </ul>

      {/* Search Filter */}
      <div className="mb-3">
        <input
          type="text"
          className="form-control book-list-search-input"
          placeholder="Search books..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Books Table */}
      {filteredAndSortedBooks.length === 0 ? (
        <p className="text-muted">No books found.</p>
      ) : (
        <table className="table table-striped">
          <thead>
            <tr>
              <th
                className="sortable-header"
                onClick={() => handleSort("title")}
              >
                Title{getSortIndicator("title")}
              </th>
              <th
                className="sortable-header"
                onClick={() => handleSort("author")}
              >
                Author{getSortIndicator("author")}
              </th>
              <th
                className="sortable-header"
                onClick={() => handleSort("year")}
              >
                Year{getSortIndicator("year")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedBooks.map((book, index) => (
              <tr key={index}>
                <td>{book.title}</td>
                <td>{book.author}</td>
                <td>{book.year || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default BookListPage;
