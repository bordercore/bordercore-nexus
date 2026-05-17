import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import type { DashboardBlob, FilterState } from "../types";
import { EMPTY_FILTERS } from "../types";
import { isFilterActive, useFilteredBlobs } from "./useFilteredBlobs";

function makeBlob(overrides: Partial<DashboardBlob> = {}): DashboardBlob {
  return {
    uuid: "00000000-0000-0000-0000-000000000000",
    name: "Untitled",
    url: "/blob/abc/",
    external_url: "",
    doctype: "note",
    tags: [],
    bucket: "today",
    created_rel: "just now",
    importance: 1,
    is_starred: false,
    is_pinned: false,
    cover_url: "",
    content: "",
    back_refs: 0,
    size: "",
    num_pages: 0,
    duration: "",
    content_type: "",
    ...overrides,
  };
}

function makeFilters(overrides: Partial<FilterState> = {}): FilterState {
  return {
    ...EMPTY_FILTERS,
    tags: new Set(EMPTY_FILTERS.tags),
    ...overrides,
  };
}

describe("useFilteredBlobs", () => {
  const note = makeBlob({ uuid: "n1", doctype: "note", tags: ["work"], bucket: "today" });
  const book = makeBlob({
    uuid: "b1",
    doctype: "book",
    tags: ["reading"],
    bucket: "this-week",
    is_starred: true,
  });
  const image = makeBlob({
    uuid: "i1",
    doctype: "image",
    tags: ["art", "work"],
    bucket: "older",
    is_pinned: true,
  });
  const blobs = [note, book, image];

  function filtered(filters: FilterState): DashboardBlob[] {
    return renderHook(() => useFilteredBlobs(blobs, filters)).result.current;
  }

  it("returns every blob when filters are empty", () => {
    expect(filtered(makeFilters())).toEqual(blobs);
  });

  it("filters by doctype", () => {
    expect(filtered(makeFilters({ doctype: "book" }))).toEqual([book]);
  });

  it("filters by tag intersection (any-match)", () => {
    expect(filtered(makeFilters({ tags: new Set(["work"]) }))).toEqual([note, image]);
    expect(filtered(makeFilters({ tags: new Set(["reading", "art"]) }))).toEqual([book, image]);
  });

  it("filters by dateBucket", () => {
    expect(filtered(makeFilters({ dateBucket: "older" }))).toEqual([image]);
  });

  it("filters by starredOnly", () => {
    expect(filtered(makeFilters({ starredOnly: true }))).toEqual([book]);
  });

  it("filters by pinnedOnly", () => {
    expect(filtered(makeFilters({ pinnedOnly: true }))).toEqual([image]);
  });

  it("AND-combines multiple filters", () => {
    expect(
      filtered(makeFilters({ doctype: "image", tags: new Set(["work"]), pinnedOnly: true }))
    ).toEqual([image]);
    expect(
      filtered(makeFilters({ doctype: "image", tags: new Set(["work"]), starredOnly: true }))
    ).toEqual([]);
  });

  it("memoizes the result when inputs are stable", () => {
    const filters = makeFilters({ doctype: "book" });
    const { result, rerender } = renderHook(({ b, f }) => useFilteredBlobs(b, f), {
      initialProps: { b: blobs, f: filters },
    });
    const first = result.current;
    rerender({ b: blobs, f: filters });
    expect(result.current).toBe(first);
  });
});

describe("isFilterActive", () => {
  it("returns false for the empty filter state", () => {
    expect(isFilterActive(makeFilters())).toBe(false);
  });

  it.each<[string, Partial<FilterState>]>([
    ["doctype set", { doctype: "note" }],
    ["tags populated", { tags: new Set(["work"]) }],
    ["dateBucket set", { dateBucket: "today" }],
    ["starredOnly toggled", { starredOnly: true }],
    ["pinnedOnly toggled", { pinnedOnly: true }],
  ])("returns true when %s", (_label, overrides) => {
    expect(isFilterActive(makeFilters(overrides))).toBe(true);
  });
});
