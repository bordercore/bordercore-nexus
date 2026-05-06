import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const doGet = vi.fn();
const doPost = vi.fn();
const doDelete = vi.fn();

vi.mock("../../utils/reactUtils", () => ({
  doGet: (...args: unknown[]) => doGet(...args),
  doPost: (...args: unknown[]) => doPost(...args),
  doDelete: (...args: unknown[]) => doDelete(...args),
  EventBus: { $emit: vi.fn() },
}));

import { useTagWorkspace } from "./useTagWorkspace";
import type { TagBootstrap, CuratorUrls } from "./types";

const bootstrap: TagBootstrap = {
  active_name: "alpha",
  tag: {
    name: "alpha",
    created: "2025-01-01",
    user: "kemoore",
    pinned: false,
    meta: false,
    counts: {
      blob:       { label: "blobs",       icon: "fa-cube",          count: 3 },
      bookmark:   { label: "bookmarks",   icon: "fa-bookmark",      count: 0 },
      album:      { label: "albums",      icon: "fa-compact-disc",  count: 0 },
      collection: { label: "collections", icon: "fa-layer-group",   count: 0 },
      todo:       { label: "todos",       icon: "fa-square-check",  count: 0 },
      question:   { label: "drills",      icon: "fa-brain",         count: 0 },
      song:       { label: "songs",       icon: "fa-music",         count: 0 },
    },
    aliases: [{ uuid: "u1", name: "a-1" }],
    related: [{ tag_name: "beta", count: 2 }],
  },
  alias_library: [
    { uuid: "u1", name: "a-1", tag: "alpha" },
    { uuid: "u2", name: "b-1", tag: "beta" },
  ],
  tag_names: ["alpha", "beta"],
};

const urls: CuratorUrls = {
  tagDetailBase: "/tag/",
  tagSearchUrl: "/tag/search?query=",
  tagSnapshotUrl: "/tag/__NAME__/snapshot.json",
  pinUrl: "/tag/pin/",
  unpinUrl: "/tag/unpin/",
  setMetaUrl: "/tag/set_meta/",
  addAliasUrl: "/tag/add_alias",
  tagAliasDetailUrl: "/api/tagaliases/__UUID__/",
};

beforeEach(() => {
  doGet.mockReset();
  doPost.mockReset();
  doDelete.mockReset();
});

describe("useTagWorkspace", () => {
  it("seeds active tag and library from bootstrap", () => {
    const { result } = renderHook(() => useTagWorkspace(bootstrap, urls));
    expect(result.current.activeName).toBe("alpha");
    expect(result.current.tag.name).toBe("alpha");
    expect(result.current.aliasLibrary).toHaveLength(2);
    expect(result.current.tagNames).toEqual(["alpha", "beta"]);
  });

  it("setPinned optimistically flips and posts to pin url", () => {
    doPost.mockImplementation((_url, _params, onSuccess) => onSuccess({ data: {} }));
    const { result } = renderHook(() => useTagWorkspace(bootstrap, urls));

    act(() => result.current.setPinned(true));

    expect(result.current.tag.pinned).toBe(true);
    expect(doPost).toHaveBeenCalledWith(
      "/tag/pin/",
      { tag: "alpha" },
      expect.any(Function),
      "",
      expect.any(String),
    );
  });

  it("setPinned(false) hits the unpin url", () => {
    doPost.mockImplementation((_url, _params, onSuccess) => onSuccess({ data: {} }));
    const { result } = renderHook(() => useTagWorkspace(bootstrap, urls));

    act(() => result.current.setPinned(false));

    expect(result.current.tag.pinned).toBe(false);
    expect(doPost).toHaveBeenCalledWith(
      "/tag/unpin/",
      { tag: "alpha" },
      expect.any(Function),
      "",
      expect.any(String),
    );
  });

  it("setMeta optimistically flips and posts", () => {
    doPost.mockImplementation((_url, _params, onSuccess) => onSuccess({ data: {} }));
    const { result } = renderHook(() => useTagWorkspace(bootstrap, urls));

    act(() => result.current.setMeta(true));

    expect(result.current.tag.meta).toBe(true);
    expect(doPost).toHaveBeenCalledWith(
      "/tag/set_meta/",
      { tag: "alpha", value: "true" },
      expect.any(Function),
      "",
      expect.any(String),
    );
  });

  it("addAlias appends to active tag and library on success", async () => {
    doPost.mockImplementation((_url, _params, onSuccess) =>
      onSuccess({ data: { uuid: "uX" } }),
    );
    const { result } = renderHook(() => useTagWorkspace(bootstrap, urls));

    await act(async () => {
      await result.current.addAlias("alpha", "fresh");
    });

    expect(result.current.tag.aliases.map(a => a.name)).toContain("fresh");
    expect(result.current.aliasLibrary.some(a => a.name === "fresh")).toBe(true);
  });

  it("addAlias on a non-active tag updates library only", async () => {
    doPost.mockImplementation((_url, _params, onSuccess) =>
      onSuccess({ data: { uuid: "uY" } }),
    );
    const { result } = renderHook(() => useTagWorkspace(bootstrap, urls));

    await act(async () => {
      await result.current.addAlias("beta", "neologism");
    });

    // current tag is alpha — its aliases unchanged
    expect(result.current.tag.aliases.map(a => a.name)).not.toContain("neologism");
    // library updated
    expect(result.current.aliasLibrary.some(a => a.name === "neologism")).toBe(true);
  });

  it("addAlias rejects empty input without calling doPost", async () => {
    const { result } = renderHook(() => useTagWorkspace(bootstrap, urls));

    await act(async () => {
      await result.current.addAlias("alpha", "   ");
    });

    expect(doPost).not.toHaveBeenCalled();
  });

  it("removeAlias deletes from current tag and library", async () => {
    doDelete.mockImplementation((_url, onSuccess) => onSuccess());
    const { result } = renderHook(() => useTagWorkspace(bootstrap, urls));

    await act(async () => {
      await result.current.removeAlias("alpha", "u1");
    });

    expect(result.current.tag.aliases).toHaveLength(0);
    expect(result.current.aliasLibrary.find(a => a.uuid === "u1")).toBeUndefined();
    expect(doDelete).toHaveBeenCalledWith(
      "/api/tagaliases/u1/",
      expect.any(Function),
      "",
    );
  });

  it("setActiveName fetches snapshot and updates state", async () => {
    const beta = { ...bootstrap.tag, name: "beta", aliases: [], related: [] };
    doGet.mockImplementation((_url, onSuccess) => onSuccess({ data: beta }));

    const { result } = renderHook(() => useTagWorkspace(bootstrap, urls));

    await act(async () => {
      await result.current.setActiveName("beta");
    });

    expect(result.current.activeName).toBe("beta");
    expect(result.current.tag.name).toBe("beta");
    expect(doGet).toHaveBeenCalledWith(
      "/tag/beta/snapshot.json",
      expect.any(Function),
      expect.any(String),
    );
  });

  it("setActiveName is a no-op when name is unchanged", async () => {
    const { result } = renderHook(() => useTagWorkspace(bootstrap, urls));

    await act(async () => {
      await result.current.setActiveName("alpha");
    });

    expect(doGet).not.toHaveBeenCalled();
  });
});
