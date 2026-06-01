import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const doGet = vi.fn();
const doPost = vi.fn();

vi.mock("../../utils/reactUtils", () => ({
  doGet: (...args: unknown[]) => doGet(...args),
  doPost: (...args: unknown[]) => doPost(...args),
  EventBus: { $emit: vi.fn() },
}));

import { useRelatedObjects } from "./useRelatedObjects";
import type { RelatedObject, RelatedObjectUrls } from "./types";

const urls: RelatedObjectUrls = {
  relatedObjects: "/api/related/node-uuid/",
  add: "/api/related/add",
  remove: "/api/related/remove",
  sort: "/api/related/sort",
  editNote: "/api/related/note",
};

const items: RelatedObject[] = [
  { uuid: "o1", name: "First", url: "/blob/o1", type: "blob", note: "alpha" },
  { uuid: "o2", name: "Second", url: "/blob/o2", type: "bookmark" },
];

function seedGet(list: RelatedObject[]) {
  doGet.mockImplementation((_url: string, cb: (r: unknown) => void) => {
    cb({ data: { related_objects: list } });
  });
}

const cfg = { objectUuid: "node-uuid", nodeType: "drill" as const, urls };

beforeEach(() => {
  doGet.mockReset();
  doPost.mockReset();
});

describe("useRelatedObjects", () => {
  it("fetches the related objects on mount", async () => {
    seedGet(items);
    const { result } = renderHook(() => useRelatedObjects(cfg));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(doGet).toHaveBeenCalledTimes(1);
    expect(doGet.mock.calls[0][0]).toBe(urls.relatedObjects);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].name).toBe("First");
  });

  it("addObject posts add payload then refreshes the list", async () => {
    seedGet(items);
    doPost.mockImplementation((_url, _params, onSuccess) => onSuccess({ data: {} }));
    const { result } = renderHook(() => useRelatedObjects(cfg));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addObject("o3");
    });

    const [url, params] = doPost.mock.calls[0];
    expect(url).toBe(urls.add);
    expect(params).toMatchObject({
      node_uuid: "node-uuid",
      object_uuid: "o3",
      node_type: "drill",
    });
    // initial fetch + post-add refresh
    expect(doGet).toHaveBeenCalledTimes(2);
  });

  it("removeObject posts remove payload then refreshes", async () => {
    seedGet(items);
    doPost.mockImplementation((_url, _params, onSuccess) => onSuccess({ data: {} }));
    const { result } = renderHook(() => useRelatedObjects(cfg));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.removeObject(items[1]));

    const [url, params] = doPost.mock.calls[0];
    expect(url).toBe(urls.remove);
    expect(params).toMatchObject({
      node_uuid: "node-uuid",
      object_uuid: "o2",
      node_type: "drill",
    });
    expect(doGet).toHaveBeenCalledTimes(2);
  });

  it("reorder posts the new 1-based position and updates order optimistically", async () => {
    seedGet(items);
    doPost.mockImplementation((_url, _params, onSuccess) => onSuccess({ data: {} }));
    const { result } = renderHook(() => useRelatedObjects(cfg));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // move o1 (index 0) to where o2 (index 1) is
    act(() => result.current.reorder("o1", "o2"));

    const [url, params] = doPost.mock.calls[0];
    expect(url).toBe(urls.sort);
    expect(params).toMatchObject({
      node_uuid: "node-uuid",
      object_uuid: "o1",
      new_position: 2,
      node_type: "drill",
    });
    expect(result.current.items.map(i => i.uuid)).toEqual(["o2", "o1"]);
  });

  it("editNote posts the new note text", async () => {
    seedGet(items);
    doPost.mockImplementation((_url, _params, onSuccess) => onSuccess({ data: {} }));
    const { result } = renderHook(() => useRelatedObjects(cfg));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.editNote(items[0], "updated"));

    const [url, params] = doPost.mock.calls[0];
    expect(url).toBe(urls.editNote);
    expect(params).toMatchObject({
      node_uuid: "node-uuid",
      object_uuid: "o1",
      note: "updated",
      node_type: "drill",
    });
  });

  it("editNote is a no-op when the note text is unchanged", async () => {
    seedGet(items);
    const { result } = renderHook(() => useRelatedObjects(cfg));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.editNote(items[0], "alpha")); // same as existing note

    expect(doPost).not.toHaveBeenCalled();
  });
});
