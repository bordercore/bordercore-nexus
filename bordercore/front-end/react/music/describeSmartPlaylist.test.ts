import { describe, expect, it } from "vitest";
import { describeSmartPlaylist } from "./describeSmartPlaylist";
import type { PlaylistParameters } from "./types";

describe("describeSmartPlaylist", () => {
  it("returns empty string for null/undefined parameters", () => {
    expect(describeSmartPlaylist(undefined)).toBe("");
    expect(describeSmartPlaylist({})).toBe("");
  });

  it("renders a tag", () => {
    expect(describeSmartPlaylist({ tag: "synthwave" })).toBe("tag:synthwave");
  });

  it("renders a rating star", () => {
    expect(describeSmartPlaylist({ rating: 4 })).toBe("★4");
  });

  it("renders a year range", () => {
    expect(describeSmartPlaylist({ start_year: 1980, end_year: 1989 })).toBe("1980–1989");
  });

  it("renders exclude_albums and exclude_recent", () => {
    expect(describeSmartPlaylist({ exclude_albums: true })).toBe("¬album");
    expect(describeSmartPlaylist({ exclude_recent: 7 })).toBe("¬7d");
  });

  it("renders sort_by random", () => {
    expect(describeSmartPlaylist({ sort_by: "random" })).toBe("↻random");
  });

  it("joins multiple parts with ' · '", () => {
    const params: PlaylistParameters = {
      tag: "ambient",
      sort_by: "random",
    };
    expect(describeSmartPlaylist(params)).toBe("tag:ambient · ↻random");
  });
});
