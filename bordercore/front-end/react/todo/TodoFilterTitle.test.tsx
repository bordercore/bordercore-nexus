import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodoFilterTitle } from "./TodoFilterTitle";

const h1Text = () => screen.getByRole("heading", { level: 1 }).textContent;

describe("TodoFilterTitle", () => {
  it("shows 'Todo' as the neutral root when unfiltered", () => {
    render(<TodoFilterTitle filter={{ type: "all" }} />);
    expect(h1Text()).toBe("Todo");
  });

  it("renders Todo / Tag / value when filtered by tag", () => {
    render(<TodoFilterTitle filter={{ type: "tag", value: "work" }} />);
    expect(h1Text()).toBe("Todo/Tag/work");
  });

  it("uses the Created kind label for the created filter", () => {
    render(<TodoFilterTitle filter={{ type: "created", value: "Last Day" }} />);
    expect(h1Text()).toBe("Todo/Created/Last Day");
  });
});
