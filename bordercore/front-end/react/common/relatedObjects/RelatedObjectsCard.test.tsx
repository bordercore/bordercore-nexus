import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RelatedObjectsCard } from "./RelatedObjectsCard";
import type { RelatedObject } from "./types";

const items: RelatedObject[] = [
  {
    uuid: "o1",
    name: "First Object",
    url: "/blob/o1",
    type: "blob",
    note: "alpha",
    cover_url: "/c1.png",
  },
  { uuid: "o2", name: "Second Object", url: "/blob/o2", type: "bookmark" },
];

const handlers = {
  onRemove: vi.fn(),
  onReorder: vi.fn(),
  onEditNote: vi.fn(),
};

beforeEach(() => {
  handlers.onRemove.mockReset();
  handlers.onReorder.mockReset();
  handlers.onEditNote.mockReset();
});

function renderCard(props: Partial<React.ComponentProps<typeof RelatedObjectsCard>> = {}) {
  return render(<RelatedObjectsCard items={items} loading={false} {...handlers} {...props} />);
}

describe("RelatedObjectsCard", () => {
  it("renders a link per item pointing at the object url", () => {
    renderCard();
    const link = screen.getByRole("link", { name: "First Object" });
    expect(link).toHaveAttribute("href", "/blob/o1");
    expect(screen.getByRole("link", { name: "Second Object" })).toBeInTheDocument();
  });

  it("shows the relationship note when present", () => {
    renderCard();
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });

  it("renders an initial-letter avatar when there is no cover image", () => {
    const { container } = renderCard();
    // o1 has a cover image (decorative thumbnail, queried by selector)
    const cover = container.querySelector(".ro-thumb img");
    expect(cover).toHaveAttribute("src", "/c1.png");
    // o2 has none -> first letter fallback
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("calls onRemove with the item when the remove icon is clicked", async () => {
    const user = userEvent.setup();
    renderCard();
    const removeButtons = screen.getAllByRole("button", { name: "Remove related object" });
    await user.click(removeButtons[0]);
    expect(handlers.onRemove).toHaveBeenCalledWith(items[0]);
  });

  it("reveals an input on edit-note and saves on blur", async () => {
    const user = userEvent.setup();
    renderCard();
    const editButtons = screen.getAllByRole("button", { name: /note/i });
    await user.click(editButtons[0]);

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "updated note");
    fireEvent.blur(input);

    expect(handlers.onEditNote).toHaveBeenCalledWith(items[0], "updated note");
  });

  it("shows an empty state when there are no items", () => {
    renderCard({ items: [], showEmptyState: true });
    expect(screen.getByText(/no related objects/i)).toBeInTheDocument();
  });

  it("does not render the empty state while loading", () => {
    renderCard({ items: [], loading: true, showEmptyState: true });
    expect(screen.queryByText(/no related objects/i)).not.toBeInTheDocument();
  });
});
