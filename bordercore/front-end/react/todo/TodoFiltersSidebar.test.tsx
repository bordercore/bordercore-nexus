import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TodoFiltersSidebar } from "./TodoFiltersSidebar";
import type { PriorityOption, Tag, TimeOption } from "./types";

const priorityOptions: PriorityOption[] = [
  [1, "High", 5],
  [2, "Medium", 3],
  [3, "Low", 1],
];

const timeOptions: TimeOption[] = [
  ["today", "Today", 2],
  ["week", "This Week", 4],
];

const tags: Tag[] = [
  { name: "python", count: 7 },
  { name: "django", count: 2 },
];

interface RenderOpts {
  filterTag?: string;
  filterPriority?: string;
  filterTime?: string;
}

function renderSidebar(opts: RenderOpts = {}) {
  const handlers = {
    onToggleDrawer: vi.fn(),
    onClickTag: vi.fn(),
    onClickPriority: vi.fn(),
    onClickTime: vi.fn(),
    onCreateTodo: vi.fn(),
  };
  render(
    <TodoFiltersSidebar
      tags={tags}
      priorityOptions={priorityOptions}
      timeOptions={timeOptions}
      filterTag={opts.filterTag ?? ""}
      filterPriority={opts.filterPriority ?? ""}
      filterTime={opts.filterTime ?? ""}
      drawerOpen={false}
      {...handlers}
    />
  );
  return handlers;
}

describe("TodoFiltersSidebar", () => {
  describe("priority filter", () => {
    it("sets the priority when clicking an inactive priority row", async () => {
      const h = renderSidebar();
      const user = userEvent.setup();
      await user.click(document.querySelector('[data-priority="2"]') as HTMLElement);
      expect(h.onClickPriority).toHaveBeenCalledTimes(1);
      expect(h.onClickPriority).toHaveBeenCalledWith("2");
    });

    it("clears the priority when clicking the currently active priority row", async () => {
      const h = renderSidebar({ filterPriority: "2" });
      const user = userEvent.setup();
      await user.click(document.querySelector('[data-priority="2"]') as HTMLElement);
      expect(h.onClickPriority).toHaveBeenCalledWith("");
    });

    it("applies the 'selected' class to the active priority row only", () => {
      renderSidebar({ filterPriority: "1" });
      expect(document.querySelector('[data-priority="1"]')?.className).toMatch(/\bselected\b/);
      expect(document.querySelector('[data-priority="2"]')?.className).not.toMatch(/\bselected\b/);
    });
  });

  describe("time filter", () => {
    it("sets the time when clicking an inactive time row", async () => {
      const h = renderSidebar();
      const user = userEvent.setup();
      await user.click(screen.getByText("Today").parentElement as HTMLElement);
      expect(h.onClickTime).toHaveBeenCalledWith("today");
    });

    it("clears the time when clicking the active time row", async () => {
      const h = renderSidebar({ filterTime: "today" });
      const user = userEvent.setup();
      await user.click(screen.getByText("Today").parentElement as HTMLElement);
      expect(h.onClickTime).toHaveBeenCalledWith("");
    });
  });

  describe("tag filter", () => {
    it("sets the tag when clicking an inactive tag row", async () => {
      const h = renderSidebar();
      const user = userEvent.setup();
      await user.click(screen.getByText("python").closest(".list-with-counts") as HTMLElement);
      expect(h.onClickTag).toHaveBeenCalledWith("python");
    });

    it("clears the tag when clicking the active tag row", async () => {
      const h = renderSidebar({ filterTag: "python" });
      const user = userEvent.setup();
      await user.click(screen.getByText("python").closest(".list-with-counts") as HTMLElement);
      expect(h.onClickTag).toHaveBeenCalledWith("");
    });

    it("shows 'No tags found' when the tag list is empty", () => {
      render(
        <TodoFiltersSidebar
          tags={[]}
          priorityOptions={priorityOptions}
          timeOptions={timeOptions}
          filterTag=""
          filterPriority=""
          filterTime=""
          drawerOpen={false}
          onToggleDrawer={() => {}}
          onClickTag={() => {}}
          onClickPriority={() => {}}
          onClickTime={() => {}}
          onCreateTodo={() => {}}
        />
      );
      expect(screen.getByText("No tags found")).toBeInTheDocument();
    });
  });

  describe("All Tasks", () => {
    it("is selected when no filters are set", () => {
      renderSidebar();
      const all = screen.getByText("All Tasks").closest(".list-with-counts");
      expect(all?.className).toMatch(/\bselected\b/);
    });

    it("is not selected when any filter is set", () => {
      renderSidebar({ filterPriority: "1" });
      const all = screen.getByText("All Tasks").closest(".list-with-counts");
      expect(all?.className).not.toMatch(/\bselected\b/);
    });

    it("clears only the filters that are currently set", async () => {
      const h = renderSidebar({ filterPriority: "1", filterTime: "today" });
      const user = userEvent.setup();
      await user.click(screen.getByText("All Tasks").closest(".list-with-counts") as HTMLElement);
      expect(h.onClickPriority).toHaveBeenCalledWith("");
      expect(h.onClickTime).toHaveBeenCalledWith("");
      expect(h.onClickTag).not.toHaveBeenCalled();
    });
  });

  describe("new todo button", () => {
    it("invokes onCreateTodo when clicked", async () => {
      const h = renderSidebar();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /New Todo/ }));
      expect(h.onCreateTodo).toHaveBeenCalledTimes(1);
    });
  });
});
