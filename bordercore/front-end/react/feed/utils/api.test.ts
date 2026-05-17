import { describe, expect, it, vi, beforeEach } from "vitest";

const doPost = vi.fn();

vi.mock("../../utils/reactUtils", () => ({
  doPost: (...args: unknown[]) => doPost(...args),
}));

import { markFeedRead, markItemRead } from "./api";

beforeEach(() => {
  doPost.mockReset();
});

describe("markItemRead", () => {
  it("POSTs to the item read endpoint and forwards read_at to the caller", () => {
    const onSuccess = vi.fn();
    markItemRead(42, onSuccess);

    expect(doPost).toHaveBeenCalledTimes(1);
    const [url, body, cb, successMsg, errorMsg] = doPost.mock.calls[0];
    expect(url).toBe("/feed/items/42/read/");
    expect(body).toEqual({});
    expect(successMsg).toBe("");
    expect(errorMsg).toBe("Failed to mark item as read");

    (cb as (r: { data: { read_at: string } }) => void)({
      data: { read_at: "2026-05-17T10:00:00Z" },
    });
    expect(onSuccess).toHaveBeenCalledWith("2026-05-17T10:00:00Z");
  });
});

describe("markFeedRead", () => {
  it("POSTs to the feed mark_all_read endpoint and forwards the marked count", () => {
    const onSuccess = vi.fn();
    markFeedRead("abc-uuid", onSuccess);

    expect(doPost).toHaveBeenCalledTimes(1);
    const [url, body, cb, , errorMsg] = doPost.mock.calls[0];
    expect(url).toBe("/feed/abc-uuid/mark_all_read/");
    expect(body).toEqual({});
    expect(errorMsg).toBe("Failed to mark feed as read");

    (cb as (r: { data: { marked: number } }) => void)({ data: { marked: 7 } });
    expect(onSuccess).toHaveBeenCalledWith(7);
  });
});
