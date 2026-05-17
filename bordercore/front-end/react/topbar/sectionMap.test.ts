import { describe, expect, it } from "vitest";

import { resolveSection } from "./sectionMap";

describe("resolveSection", () => {
  it.each([
    ["/bookmark/", "Bookmarks", "bookmarks", "/bookmark/"],
    ["/bookmark/123/edit", "Bookmarks", "bookmarks", "/bookmark/"],
    ["/feed/", "Feeds", "feeds", "/feed/"],
    ["/todo/", "Todo", "todos", "/todo/"],
    ["/reminder/", "Reminders", "reminders", "/reminder/"],
    ["/search/?q=test", "Search", "search", "/search/"],
    ["/accounts/prefs/", "Settings", "settings", "/accounts/prefs/"],
    ["/metrics/", "Metrics", "metrics", "/metrics/"],
    ["/books/47", "Books", "books", "/books/"],
    ["/visualize/", "Constellation", "visualize", "/visualize/"],
  ])("resolves %s to section %s", (pathname, defaultTitle, label, rootUrl) => {
    const section = resolveSection(pathname);
    expect(section.defaultTitle).toBe(defaultTitle);
    expect(section.label).toBe(label);
    expect(section.rootUrl).toBe(rootUrl);
    expect(section.icon).toBeDefined();
  });

  it("returns the default home section for unknown paths", () => {
    const section = resolveSection("/some-unknown-path/");
    expect(section.defaultTitle).toBe("Bordercore");
    expect(section.label).toBeUndefined();
    expect(section.rootUrl).toBeUndefined();
    expect(section.icon).toBeDefined();
  });

  it("returns the default home section for an empty pathname", () => {
    expect(resolveSection("").defaultTitle).toBe("Bordercore");
  });

  it("matches /books without a trailing slash (prefix is '/books')", () => {
    expect(resolveSection("/books").defaultTitle).toBe("Books");
  });
});
