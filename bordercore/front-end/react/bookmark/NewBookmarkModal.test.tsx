import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const doPost = vi.fn();
const doGet = vi.fn();

vi.mock("../utils/reactUtils", () => ({
  doPost: (...args: unknown[]) => doPost(...args),
  doGet: (...args: unknown[]) => doGet(...args),
  EventBus: { $emit: vi.fn() },
}));

import NewBookmarkModal from "./NewBookmarkModal";

function baseProps(overrides: Partial<React.ComponentProps<typeof NewBookmarkModal>> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    createApiUrl: "/bookmark/api/create/",
    tagSearchUrl: "/tag/search/",
    getTitleFromUrl: "/bookmark/get_title_from_url/",
    onAdd: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  doPost.mockReset();
  doGet.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("NewBookmarkModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<NewBookmarkModal {...baseProps({ open: false })} />);
    expect(container.textContent).toBe("");
  });

  it("renders the eyebrow, title, and all fields when open", () => {
    render(<NewBookmarkModal {...baseProps()} />);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("create new bookmark");
    expect(screen.getByRole("heading", { name: /create a bookmark/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^url$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^note/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/important/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pinned/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/daily/i)).toBeInTheDocument();
  });

  it("disables Create until url and name are both filled", async () => {
    const user = userEvent.setup();
    render(<NewBookmarkModal {...baseProps()} />);
    const submit = screen.getByRole("button", { name: /^create$/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/^url$/i), "https://example.com");
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/^name$/i), "Example");
    expect(submit).toBeEnabled();
  });

  it("auto-fetches the page title on URL blur when name is empty", async () => {
    const user = userEvent.setup();
    doGet.mockImplementation((_url, cb: (r: unknown) => void) => {
      cb({ data: { title: "Example Domain" } });
    });

    render(<NewBookmarkModal {...baseProps()} />);
    await user.type(screen.getByLabelText(/^url$/i), "https://example.com");
    await user.tab();

    expect(doGet).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Example Domain");
  });

  it("does not fetch the title when the name is already filled", async () => {
    const user = userEvent.setup();
    render(<NewBookmarkModal {...baseProps()} />);
    await user.type(screen.getByLabelText(/^name$/i), "Manual title");
    await user.type(screen.getByLabelText(/^url$/i), "https://example.com");
    await user.tab();
    expect(doGet).not.toHaveBeenCalled();
  });

  it("submits via doPost with the correct payload, then fires onAdd and onClose", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onClose = vi.fn();
    doPost.mockImplementation((_url, _params, cb: (r: unknown) => void) => {
      cb({ data: { uuid: "new-uuid", url: "https://example.com", name: "Example" } });
    });

    render(<NewBookmarkModal {...baseProps({ onAdd, onClose })} />);
    await user.type(screen.getByLabelText(/^url$/i), "https://example.com");
    await user.type(screen.getByLabelText(/^name$/i), "Example");
    await user.click(screen.getByLabelText(/important/i));
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(doPost).toHaveBeenCalledTimes(1);
    const [calledUrl, params] = doPost.mock.calls[0];
    expect(calledUrl).toBe("/bookmark/api/create/");
    expect(params).toMatchObject({
      url: "https://example.com",
      name: "Example",
      importance: "true",
      is_pinned: "false",
      daily: "false",
    });
    expect(onAdd).toHaveBeenCalledWith({
      uuid: "new-uuid",
      url: "https://example.com",
      name: "Example",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submits on Enter in the name input", async () => {
    const user = userEvent.setup();
    doPost.mockImplementation((_u, _p, cb: (r: unknown) => void) =>
      cb({ data: { uuid: "x", url: "https://x", name: "X" } })
    );
    render(<NewBookmarkModal {...baseProps()} />);
    await user.type(screen.getByLabelText(/^url$/i), "https://x");
    await user.click(screen.getByLabelText(/^name$/i));
    await user.keyboard("X{Enter}");
    expect(doPost).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and via the scrim / close / cancel controls", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NewBookmarkModal {...baseProps({ onClose })} />);

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
