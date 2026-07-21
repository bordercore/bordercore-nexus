import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import TodoRow from "./TodoRow";
import type { Todo } from "./types";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const todo: Todo = {
  uuid: "t1",
  name: "Write tests",
  note: "",
  url: null,
  priority: 3,
  priority_name: "Medium",
  created: "2026-06-26T00:00:00Z",
  created_unixtime: 0,
  tags: ["work"],
  due_date: null,
  sort_order: 3,
};

function renderRow(props: Record<string, unknown> = {}) {
  const handlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onMoveToTop: vi.fn(),
    onSwipeOpenChange: vi.fn(),
  };
  const { container } = render(
    <DndContext>
      <SortableContext items={[todo.uuid]}>
        <TodoRow
          todo={todo}
          canDrag={false}
          isSortable={true}
          showTags={true}
          view="normal"
          isMobile={true}
          isSwipeOpen={false}
          {...handlers}
          {...props}
        />
      </SortableContext>
    </DndContext>
  );
  return { container, handlers };
}

describe("TodoRow mobile swipe actions", () => {
  beforeEach(() => mockMatchMedia(true));

  it("renders a Move-to-top / Edit / Delete swipe tray", () => {
    const { container } = renderRow();
    const tray = container.querySelector(".todo-swipe-tray");
    expect(tray).not.toBeNull();
    expect(tray!.querySelectorAll(".todo-swipe-action").length).toBe(3);
    expect(tray!.querySelector(".movetop")).not.toBeNull();
  });

  it("omits Move-to-top when the todo is already at the top", () => {
    const { container } = renderRow({ todo: { ...todo, sort_order: 1 } });
    const tray = container.querySelector(".todo-swipe-tray")!;
    expect(tray.querySelectorAll(".todo-swipe-action").length).toBe(2);
    expect(tray.querySelector(".movetop")).toBeNull();
  });

  it("wires the tray buttons to the action handlers", () => {
    const { container, handlers } = renderRow();
    const tray = container.querySelector(".todo-swipe-tray")!;

    fireEvent.click(tray.querySelector(".delete")!);
    expect(handlers.onDelete).toHaveBeenCalledWith(todo);

    fireEvent.click(tray.querySelector(".edit")!);
    expect(handlers.onEdit).toHaveBeenCalledWith(todo);

    fireEvent.click(tray.querySelector(".movetop")!);
    expect(handlers.onMoveToTop).toHaveBeenCalledWith(todo);
  });
});

describe("TodoRow desktop", () => {
  beforeEach(() => mockMatchMedia(false));

  it("renders no swipe tray, keeping the dropdown row layout", () => {
    const { container } = renderRow({ isMobile: false });
    expect(container.querySelector(".todo-swipe-tray")).toBeNull();
    // The inner wrapper is still present (transparent via display:contents).
    expect(container.querySelector(".todo-row-inner")).not.toBeNull();
  });
});

describe("TodoRow note markdown", () => {
  beforeEach(() => mockMatchMedia(false));

  it("renders markdown links that open in a new tab", () => {
    const { container } = renderRow({
      isMobile: false,
      todo: { ...todo, note: "See [the docs](https://example.com/docs)" },
    });
    const link = container.querySelector<HTMLAnchorElement>(".todo-row-desc a")!;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("https://example.com/docs");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.textContent).toBe("the docs");
  });

  it("linkifies bare URLs and renders bullet lists and emphasis", () => {
    const { container } = renderRow({
      isMobile: false,
      todo: { ...todo, note: "- first **bold**\n- https://example.com" },
    });
    const desc = container.querySelector(".todo-row-desc")!;
    expect(desc.querySelectorAll("li").length).toBe(2);
    expect(desc.querySelector("strong")!.textContent).toBe("bold");
    expect(desc.querySelector("a")!.getAttribute("href")).toBe("https://example.com");
  });

  it("escapes raw HTML in the note", () => {
    const { container } = renderRow({
      isMobile: false,
      todo: { ...todo, note: "<img src=x onerror=alert(1)> plain" },
    });
    const desc = container.querySelector(".todo-row-desc")!;
    expect(desc.querySelector("img")).toBeNull();
    expect(desc.textContent).toContain("<img src=x onerror=alert(1)> plain");
  });

  it("follows note links without opening the edit modal", () => {
    const { container, handlers } = renderRow({
      isMobile: false,
      todo: { ...todo, note: "[link](https://example.com)" },
    });
    fireEvent.click(container.querySelector(".todo-row-desc a")!);
    expect(handlers.onEdit).not.toHaveBeenCalled();

    // Clicking non-link note text still opens the edit modal.
    fireEvent.click(container.querySelector(".todo-row-desc")!);
    expect(handlers.onEdit).toHaveBeenCalledWith(expect.objectContaining({ uuid: todo.uuid }));
  });
});
