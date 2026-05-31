import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import FeedSidebar, { reorderFeedList } from "./FeedSidebar";
import type { Feed } from "./types";

function makeFeed(id: number, name: string): Feed {
  return {
    id,
    uuid: `uuid-${id}`,
    name,
    homepage: null,
    url: `https://example.com/${id}`,
    lastCheck: new Date().toISOString(),
    lastResponse: 200,
    lastResponseCode: 200,
    feedItems: [],
  };
}

const feeds = [makeFeed(1, "Alpha"), makeFeed(2, "Beta"), makeFeed(3, "Gamma")];

describe("reorderFeedList", () => {
  it("moves a feed and reports its new 1-indexed position", () => {
    const result = reorderFeedList(feeds, 1, 3);
    expect(result).not.toBeNull();
    expect(result!.feedId).toBe(1);
    expect(result!.position).toBe(3);
    expect(result!.list.map(f => f.id)).toEqual([2, 3, 1]);
  });

  it("moves a feed upward", () => {
    const result = reorderFeedList(feeds, 3, 1);
    expect(result!.position).toBe(1);
    expect(result!.list.map(f => f.id)).toEqual([3, 1, 2]);
  });

  it("returns null for a no-op move onto itself", () => {
    expect(reorderFeedList(feeds, 2, 2)).toBeNull();
  });

  it("returns null when an id is not in the list", () => {
    expect(reorderFeedList(feeds, 99, 1)).toBeNull();
    expect(reorderFeedList(feeds, 1, 99)).toBeNull();
  });
});

describe("FeedSidebar", () => {
  const baseProps = {
    feedList: feeds,
    activeFeedId: 1,
    onSelectFeed: () => {},
    onNewFeed: () => {},
  };

  it("renders a drag handle for every feed", () => {
    render(<FeedSidebar {...baseProps} onReorderFeeds={() => {}} />);
    expect(screen.getAllByLabelText("Drag to reorder")).toHaveLength(feeds.length);
  });

  it("selects a feed when its button is clicked", async () => {
    const onSelectFeed = vi.fn();
    render(<FeedSidebar {...baseProps} onSelectFeed={onSelectFeed} onReorderFeeds={() => {}} />);
    await userEvent.click(screen.getByText("Gamma"));
    expect(onSelectFeed).toHaveBeenCalledWith(3);
  });
});
