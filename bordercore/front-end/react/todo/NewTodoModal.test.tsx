import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const doPost = vi.fn();

vi.mock("../utils/reactUtils", () => ({
  doPost: (...args: unknown[]) => doPost(...args),
  EventBus: { $emit: vi.fn() },
}));

import NewTodoModal from "./NewTodoModal";

const priorityList: [number, string, number?][] = [
  [1, "High", 0],
  [2, "Normal", 0],
  [3, "Low", 0],
];

function baseProps(overrides: Partial<React.ComponentProps<typeof NewTodoModal>> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    createTodoUrl: "/todo/create/",
    tagSearchUrl: "/tag/search/?q=",
    priorityList,
    onAdd: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  doPost.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("NewTodoModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<NewTodoModal {...baseProps({ open: false })} />);
    expect(container.textContent).toBe("");
  });

  it("renders the title and all fields when open", () => {
    render(<NewTodoModal {...baseProps()} />);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("create new todo");
    expect(screen.getByRole("heading", { name: /create a todo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^priority$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^due date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^note/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^url/i)).toBeInTheDocument();
  });

  it("resets fields when re-opened and seeds initial values", () => {
    const { rerender } = render(
      <NewTodoModal {...baseProps({ open: false, initialPriority: 1, initialTags: ["work"] })} />
    );
    rerender(
      <NewTodoModal {...baseProps({ open: true, initialPriority: 1, initialTags: ["work"] })} />
    );
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("");
    expect(screen.getByLabelText(/^priority$/i)).toHaveValue("1");
    expect(screen.getByLabelText(/^note/i)).toHaveValue("");
  });

  it("disables the create button until a name is entered", async () => {
    const user = userEvent.setup();
    render(<NewTodoModal {...baseProps()} />);
    const create = screen.getByRole("button", { name: /^create$/i });
    expect(create).toBeDisabled();
    await user.type(screen.getByLabelText(/^name$/i), "ship things");
    expect(create).toBeEnabled();
  });

  it("submits via doPost when create is clicked, then fires onAdd and onClose", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onClose = vi.fn();
    doPost.mockImplementation((_url, _params, cb: (r: unknown) => void) => {
      cb({ data: { uuid: "new-todo-uuid" } });
    });

    render(<NewTodoModal {...baseProps({ onAdd, onClose })} />);
    await user.type(screen.getByLabelText(/^name$/i), "write report");
    await user.selectOptions(screen.getByLabelText(/^priority$/i), "1");
    await user.type(screen.getByLabelText(/^url/i), "https://example.com");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(doPost).toHaveBeenCalledTimes(1);
    const [calledUrl, params] = doPost.mock.calls[0];
    expect(calledUrl).toBe("/todo/create/");
    expect(params).toMatchObject({
      name: "write report",
      priority: 1,
      url: "https://example.com",
    });
    expect(onAdd).toHaveBeenCalledWith("new-todo-uuid");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submits on Enter in the name input", async () => {
    const user = userEvent.setup();
    doPost.mockImplementation((_u, _p, cb: (r: unknown) => void) => cb({ data: { uuid: "x" } }));
    render(<NewTodoModal {...baseProps()} />);
    await user.type(screen.getByLabelText(/^name$/i), "fast task");
    await user.keyboard("{Enter}");
    expect(doPost).toHaveBeenCalledTimes(1);
  });

  it("does not submit when the name is empty", async () => {
    const user = userEvent.setup();
    render(<NewTodoModal {...baseProps()} />);
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(doPost).not.toHaveBeenCalled();
  });

  it("closes on Escape and via the scrim / close / cancel controls", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NewTodoModal {...baseProps({ onClose })} />);

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
