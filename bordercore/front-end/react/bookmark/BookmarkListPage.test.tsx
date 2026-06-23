import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BookmarkListPage from "./BookmarkListPage";

const axiosGet = vi.fn();
const axiosCall = vi.fn();

vi.mock("axios", () => {
  const mock = Object.assign((...args: any[]) => axiosCall(...args), {
    get: (...args: any[]) => axiosGet(...args),
    isCancel: () => false,
    defaults: { xsrfCookieName: "", xsrfHeaderName: "", withCredentials: false },
  });
  return { default: mock };
});

const urls = {
  getBookmarksByPage: "/bookmark/list/page/666/",
  getBookmarksByTag: "/bookmark/list/tag/666/",
  getBookmarksByKeyword: "/bookmark/list/keyword/666/",
  getTagsUsedByBookmarks: "/bookmark/tag/search/",
  bookmarkDetail: "/bookmark/00000000-0000-0000-0000-000000000000/",
  bookmarkUpdate: "/bookmark/update/00000000-0000-0000-0000-000000000000/",
  bookmarkCreate: "/bookmark/create/",
  bookmarkCreateApi: "/bookmark/api/create/",
  tagSearch: "/tag/search/",
  getTitleFromUrl: "/bookmark/get_title_from_url/",
  bookmarkSort: "/bookmark/sort/",
  addTag: "/bookmark/add_tag",
  removeTag: "/bookmark/remove_tag",
  sortPinnedTags: "/bookmark/tag/sort/",
  pinTag: "/tag/pin/",
  unpinTag: "/tag/unpin/",
  pinBookmark: "/bookmark/pin/00000000-0000-0000-0000-000000000000/",
  unpinBookmark: "/bookmark/unpin/00000000-0000-0000-0000-000000000000/",
  storeInSession: "/accounts/store_in_session/",
};

const stats = {
  total_count: 0,
  untagged_count: 0,
  broken_count: 0,
  top_domain: "—",
  tag_coverage_pct: 0,
};

function renderPage(initialSearchMode: "tags" | "terms") {
  return render(
    <BookmarkListPage
      initialTag={null}
      initialPinnedTags={[]}
      initialPinnedBookmarks={[]}
      untaggedCount={0}
      initialViewType="normal"
      initialSearchMode={initialSearchMode}
      stats={stats}
      urls={urls}
    />
  );
}

describe("BookmarkListPage search mode", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosCall.mockReset();
    // Tag suggestion requests carry "query="; everything else is a list fetch.
    axiosGet.mockImplementation((url: string) => {
      if (url.includes("query=")) {
        return Promise.resolve({ data: [{ label: "django" }, { label: "python" }] });
      }
      return Promise.resolve({ data: { bookmarks: [], pagination: { page_number: 1 } } });
    });
    axiosCall.mockResolvedValue({ data: {} });
  });

  it("defaults to Terms mode: no tag dropdown, Enter runs a keyword search", async () => {
    renderPage("terms");
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "django" } });

    // No autocomplete request and no dropdown in Terms mode.
    await new Promise(resolve => setTimeout(resolve, 350));
    expect(document.querySelector(".select-value-dropdown")).toBeNull();
    expect(axiosGet).not.toHaveBeenCalledWith(expect.stringContaining("query="), expect.anything());

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(axiosGet).toHaveBeenCalledWith("/bookmark/list/keyword/django/", expect.anything());
    });
  });

  it("Tags mode shows the tag suggestion dropdown while typing", async () => {
    renderPage("tags");
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "dj" } });

    await waitFor(() => {
      expect(document.querySelector(".select-value-dropdown")).not.toBeNull();
    });
    expect(axiosGet).toHaveBeenCalledWith(expect.stringContaining("query=dj"), expect.anything());
  });
});
