import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DENSITY_STOPS,
  loadDensity,
  saveDensity,
  densityFromIndex,
  indexFromDensity,
  STORAGE_KEY,
} from "./density";

describe("density stops", () => {
  it("has three ordered stops", () => {
    expect(DENSITY_STOPS).toEqual(["compact", "grid", "cinema"]);
  });
});

describe("indexFromDensity / densityFromIndex", () => {
  it("round-trips each stop", () => {
    DENSITY_STOPS.forEach((stop, i) => {
      expect(indexFromDensity(stop)).toBe(i);
      expect(densityFromIndex(i)).toBe(stop);
    });
  });

  it("clamps invalid indices to 'grid'", () => {
    expect(densityFromIndex(-1)).toBe("grid");
    expect(densityFromIndex(99)).toBe("grid");
  });
});

describe("loadDensity / saveDensity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns 'grid' as the default when storage is empty", () => {
    expect(loadDensity()).toBe("grid");
  });

  it("returns the saved value when it is a valid stop", () => {
    saveDensity("cinema");
    expect(loadDensity()).toBe("cinema");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("cinema");
  });

  it("falls back to 'grid' when the saved value is invalid", () => {
    localStorage.setItem(STORAGE_KEY, "junk");
    expect(loadDensity()).toBe("grid");
  });

  it("falls back to 'grid' when storage throws", () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(loadDensity()).toBe("grid");
    } finally {
      Storage.prototype.getItem = orig;
    }
  });
});
