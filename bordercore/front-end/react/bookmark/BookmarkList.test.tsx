import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import BookmarkList from "./BookmarkList";
import type { Bookmark } from "./types";

vi.mock("axios", () => {
  const mock = Object.assign(() => Promise.resolve({ data: {} }), {
    get: () => Promise.resolve({ data: {} }),
    isCancel: () => false,
    defaults: { xsrfCookieName: "", xsrfHeaderName: "", withCredentials: false },
  });
  return { default: mock };
});

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const bookmarks: Bookmark[] = [
  {
    uuid: "u1",
    name: "First Bookmark",
    url: "https://example.com/1",
    created: "Jun 24, 2026",
    tags: ["react"],
    is_pinned: false,
  },
  {
    uuid: "u2",
    name: "Second Bookmark",
    url: "https://example.com/2",
    created: null,
    tags: [],
    is_pinned: true,
  },
];

function renderList() {
  const handlers = {
    onBookmarksChange: vi.fn(),
    onClickBookmark: vi.fn(),
    onEditBookmark: vi.fn(),
    onDeleteBookmark: vi.fn(),
    onClickTag: vi.fn(),
    onPinBookmark: vi.fn(),
    onUnpinBookmark: vi.fn(),
  };
  const { container } = render(
    <BookmarkList
      bookmarks={bookmarks}
      viewType="normal"
      selectedTagName={null}
      selectedBookmarkUuid={null}
      sortUrl="/bookmark/sort/"
      editBookmarkUrl="/bookmark/update/x/"
      {...handlers}
    />
  );
  return { container, handlers };
}

describe("BookmarkList mobile swipe actions", () => {
  beforeEach(() => mockMatchMedia(true));

  it("renders a Pin/Edit/Delete swipe tray for each row", () => {
    const { container } = renderList();
    const trays = container.querySelectorAll(".bookmark-swipe-tray");
    expect(trays.length).toBe(2);
    expect(trays[0].querySelectorAll(".bookmark-swipe-action").length).toBe(3);
    // First row is unpinned ("Pin"), second is pinned ("Unpin").
    expect(trays[0].querySelector(".bookmark-swipe-action.pin")?.textContent).toMatch(/^pin$/i);
    expect(trays[1].querySelector(".bookmark-swipe-action.pin")?.textContent).toMatch(/unpin/i);
  });

  it("wires the tray buttons to the action handlers", () => {
    const { container, handlers } = renderList();
    const trays = container.querySelectorAll(".bookmark-swipe-tray");

    fireEvent.click(trays[0].querySelector(".bookmark-swipe-action.delete")!);
    expect(handlers.onDeleteBookmark).toHaveBeenCalledWith("u1");

    fireEvent.click(trays[0].querySelector(".bookmark-swipe-action.edit")!);
    expect(handlers.onEditBookmark).toHaveBeenCalledWith("u1");

    fireEvent.click(trays[0].querySelector(".bookmark-swipe-action.pin")!);
    expect(handlers.onPinBookmark).toHaveBeenCalledWith("u1");

    // Second row is already pinned, so its pin button unpins.
    fireEvent.click(trays[1].querySelector(".bookmark-swipe-action.pin")!);
    expect(handlers.onUnpinBookmark).toHaveBeenCalledWith("u2");
  });
});

describe("BookmarkList desktop", () => {
  beforeEach(() => mockMatchMedia(false));

  it("renders no swipe tray, keeping the dropdown row layout", () => {
    const { container } = renderList();
    expect(container.querySelector(".bookmark-swipe-tray")).toBeNull();
    // The inner wrapper is still present (transparent via display:contents).
    expect(container.querySelector(".bookmark-row-inner")).not.toBeNull();
  });
});
