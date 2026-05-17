import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PageHead } from "./PageHead";

function renderHead(overrides: Partial<React.ComponentProps<typeof PageHead>> = {}) {
  const props = {
    total: 5,
    active: 3,
    query: "",
    onQueryChange: vi.fn(),
    onNew: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<PageHead {...props} />) };
}

describe("PageHead", () => {
  it("shows the total and active counts", () => {
    renderHead({ total: 12, active: 7 });
    const sub = screen.getByText(/total/);
    expect(sub.textContent).toMatch(/12\s*total/);
    expect(sub.textContent).toMatch(/7\s*active/);
  });

  it("renders the heading and the new-reminder button", () => {
    renderHead();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Reminders");
    expect(screen.getByRole("button", { name: /new/i })).toBeInTheDocument();
  });

  it("renders the query input bound to the supplied value", () => {
    renderHead({ query: "groceries" });
    const input = screen.getByLabelText(/filter reminders/i) as HTMLInputElement;
    expect(input.value).toBe("groceries");
  });

  it("calls onQueryChange as the user types", async () => {
    const user = userEvent.setup();
    const { props } = renderHead();
    const input = screen.getByLabelText(/filter reminders/i);
    await user.type(input, "ab");
    expect(props.onQueryChange).toHaveBeenCalledWith("a");
    expect(props.onQueryChange).toHaveBeenCalledWith("b");
  });

  it("calls onNew when the new button is clicked", async () => {
    const user = userEvent.setup();
    const { props } = renderHead();
    await user.click(screen.getByRole("button", { name: /new/i }));
    expect(props.onNew).toHaveBeenCalledTimes(1);
  });

  it("renders extra children in the bottom row", () => {
    renderHead({ children: <span data-testid="extra">extra-slot</span> });
    expect(screen.getByTestId("extra")).toBeInTheDocument();
  });
});
