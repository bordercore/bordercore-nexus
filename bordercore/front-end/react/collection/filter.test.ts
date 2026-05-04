import { describe, expect, it } from "vitest";
import { filterCollections } from "./filter";
import type { Collection } from "./types";

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    uuid: "1",
    name: "Sample",
    url: "/c/1",
    num_objects: 0,
    description: "",
    tags: [],
    modified: "now",
    is_favorite: true,
    cover_tiles: [null, null, null, null],
    ...overrides,
  };
}

describe("filterCollections", () => {
  it("returns all collections when query is empty and tag is null", () => {
    const cs = [makeCollection({ uuid: "1" }), makeCollection({ uuid: "2" })];
    expect(filterCollections(cs, "", null)).toHaveLength(2);
  });

  it("matches by name (case-insensitive)", () => {
    const cs = [
      makeCollection({ uuid: "1", name: "Cyberpunk Inspiration" }),
      makeCollection({ uuid: "2", name: "Travel Photos" }),
    ];
    expect(filterCollections(cs, "cyber", null).map(c => c.uuid)).toEqual(["1"]);
    expect(filterCollections(cs, "PHOTOS", null).map(c => c.uuid)).toEqual(["2"]);
  });

  it("matches by description", () => {
    const cs = [
      makeCollection({ uuid: "1", description: "Vintage poster art" }),
      makeCollection({ uuid: "2", description: "Modern UI examples" }),
    ];
    expect(filterCollections(cs, "vintage", null).map(c => c.uuid)).toEqual(["1"]);
  });

  it("filters by active tag", () => {
    const cs = [
      makeCollection({ uuid: "1", tags: ["cyberpunk", "art"] }),
      makeCollection({ uuid: "2", tags: ["food"] }),
    ];
    expect(filterCollections(cs, "", "cyberpunk").map(c => c.uuid)).toEqual(["1"]);
    expect(filterCollections(cs, "", "food").map(c => c.uuid)).toEqual(["2"]);
  });

  it("composes search and tag filter as AND", () => {
    const cs = [
      makeCollection({ uuid: "1", name: "Cyberpunk Art", tags: ["cyberpunk"] }),
      makeCollection({ uuid: "2", name: "Cyberpunk Music", tags: ["music"] }),
      makeCollection({ uuid: "3", name: "Renaissance Art", tags: ["cyberpunk"] }),
    ];
    expect(filterCollections(cs, "cyberpunk", "cyberpunk").map(c => c.uuid)).toEqual(["1"]);
  });

  it("returns empty when nothing matches", () => {
    const cs = [makeCollection({ uuid: "1", name: "Foo" })];
    expect(filterCollections(cs, "bar", null)).toEqual([]);
  });
});
