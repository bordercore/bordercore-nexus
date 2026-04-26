import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const doPut = vi.fn();

vi.mock("../utils/reactUtils", () => ({
  doPut: (...args: unknown[]) => doPut(...args),
  EventBus: { $emit: vi.fn() },
}));

import EditTodoModal from "./EditTodoModal";
import type { EditTodoInfo } from "./EditTodoModal";

const priorityList: [number, string, number?][] = [
  [1, "High", 0],
  [2, "Normal", 0],
  [3, "Low", 0],
];

function baseTodo(): EditTodoInfo {
  return {
    uuid: "todo-uuid",
    name: "ship Q2 review",
    priority: 1,
    note: "draft sent for review",
    tags: ["work"],
    url: "https://example.com/q2",
    due_date: "2026-05-12",
  };
}

function baseProps(overrides: Partial<React.ComponentProps<typeof EditTodoModal>> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    editTodoUrl: "/todo/00000000-0000-0000-0000-000000000000/edit/",
    tagSearchUrl: "/tag/search/?q=",
    priorityList,
    todoInfo: baseTodo(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  doPut.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("EditTodoModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<EditTodoModal {...baseProps({ open: false })} />);
    expect(container.textContent).toBe("");
  });

  it("seeds fields from todoInfo when opened", () => {
    render(<EditTodoModal {...baseProps()} />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("ship Q2 review");
    expect(screen.getByLabelText(/^priority$/i)).toHaveValue("1");
    expect(screen.getByLabelText(/^note/i)).toHaveValue("draft sent for review");
    expect(screen.getByLabelText(/^url/i)).toHaveValue("https://example.com/q2");
    // Date picker is a button that shows the date formatted for display.
    expect(screen.getByLabelText(/^due date/i)).toHaveTextContent(/May 12, 2026/);
  });

  it("submits via doPut, fires onEdit, and closes", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onClose = vi.fn();
    doPut.mockImplementation((_url, _params, cb: (r: unknown) => void) => {
      cb({ data: { uuid: "todo-uuid" } });
    });

    render(<EditTodoModal {...baseProps({ onEdit, onClose })} />);
    const name = screen.getByLabelText(/^name$/i);
    await user.clear(name);
    await user.type(name, "ship Q2 review (final)");
    await user.click(screen.getByRole("button", { name: /^save/i }));

    expect(doPut).toHaveBeenCalledTimes(1);
    const [calledUrl, params] = doPut.mock.calls[0];
    expect(calledUrl).toBe("/todo/todo-uuid/edit/");
    expect(params).toMatchObject({
      todo_uuid: "todo-uuid",
      name: "ship Q2 review (final)",
      priority: 1,
    });
    expect(onEdit).toHaveBeenCalledWith("todo-uuid");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables Save when name is cleared", async () => {
    const user = userEvent.setup();
    render(<EditTodoModal {...baseProps()} />);
    await user.clear(screen.getByLabelText(/^name$/i));
    expect(screen.getByRole("button", { name: /^save/i })).toBeDisabled();
  });

  it("invokes onDelete with todoInfo and closes when delete is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(<EditTodoModal {...baseProps({ onDelete, onClose })} />);
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ uuid: "todo-uuid" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submits on Enter in the name input", async () => {
    const user = userEvent.setup();
    doPut.mockImplementation((_u, _p, cb: (r: unknown) => void) =>
      cb({ data: { uuid: "todo-uuid" } })
    );
    render(<EditTodoModal {...baseProps()} />);
    await user.click(screen.getByLabelText(/^name$/i));
    await user.keyboard("{Enter}");
    expect(doPut).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and via the scrim / close / cancel controls", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EditTodoModal {...baseProps({ onClose })} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(document.querySelector(".refined-modal-scrim")!);
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(3);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(4);
  });
});
