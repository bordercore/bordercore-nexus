import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import BookmarkFilterTitle from "./BookmarkFilterTitle";

const h1Text = () => screen.getByRole("heading", { level: 1 }).textContent;

describe("BookmarkFilterTitle", () => {
  it("renders the neutral root when nothing is active", () => {
    render(<BookmarkFilterTitle tag={null} search={null} />);
    expect(h1Text()).toBe("Bookmarks");
  });

  it("renders Bookmarks / Untagged on the untagged landing", () => {
    render(<BookmarkFilterTitle tag="Untagged" search={null} />);
    expect(h1Text()).toBe("Bookmarks/Untagged");
  });

  it("renders Bookmarks / Tag / value for a real tag", () => {
    render(<BookmarkFilterTitle tag="work" search={null} />);
    expect(h1Text()).toBe("Bookmarks/Tag/work");
  });

  it("renders Bookmarks / Search / term, taking precedence over a tag", () => {
    render(<BookmarkFilterTitle tag="work" search="django" />);
    expect(h1Text()).toBe("Bookmarks/Search/django");
  });
});
