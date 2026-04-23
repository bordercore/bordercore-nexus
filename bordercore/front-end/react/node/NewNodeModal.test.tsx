import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import NewNodeModal from "./NewNodeModal";

function baseProps(overrides: Partial<React.ComponentProps<typeof NewNodeModal>> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    createUrl: "/node/create/",
    csrfToken: "csrf-token-123",
    ...overrides,
  };
}

// HTMLFormElement.submit() isn't patched away in jsdom, but it also isn't a
// real submission — we spy so we can assert it was called without the test
// harness objecting to navigation.
let submitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  submitSpy = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
});

afterEach(() => {
  submitSpy.mockRestore();
});

describe("NewNodeModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<NewNodeModal {...baseProps({ open: false })} />);
    expect(container.textContent).toBe("");
  });

  it("wires the form to createUrl with an embedded CSRF token", () => {
    render(<NewNodeModal {...baseProps()} />);
    const form = screen.getByRole("dialog") as HTMLFormElement;
    expect(form.getAttribute("action")).toBe("/node/create/");
    expect(form.getAttribute("method")).toBe("post");
    const csrf = form.querySelector<HTMLInputElement>('input[name="csrfmiddlewaretoken"]');
    expect(csrf?.value).toBe("csrf-token-123");
  });

  it("resets fields when opened", () => {
    render(<NewNodeModal {...baseProps()} />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("");
    expect(screen.getByLabelText(/^note/i)).toHaveValue("");
  });

  it("disables the create button until a name is entered", async () => {
    const user = userEvent.setup();
    render(<NewNodeModal {...baseProps()} />);
    const create = screen.getByRole("button", { name: /create node/i });
    expect(create).toBeDisabled();

    await user.type(screen.getByLabelText(/^name$/i), "new name");
    expect(create).toBeEnabled();
  });

  it("submits the underlying form when create is clicked with a valid name", async () => {
    const user = userEvent.setup();
    render(<NewNodeModal {...baseProps()} />);
    await user.type(screen.getByLabelText(/^name$/i), "new name");
    await user.click(screen.getByRole("button", { name: /create node/i }));
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("submits on Enter in the name input", async () => {
    const user = userEvent.setup();
    render(<NewNodeModal {...baseProps()} />);
    const input = screen.getByLabelText(/^name$/i);
    await user.type(input, "new name");
    await user.keyboard("{Enter}");
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it("does not submit when the name is empty", async () => {
    const user = userEvent.setup();
    render(<NewNodeModal {...baseProps()} />);
    await user.click(screen.getByRole("button", { name: /create node/i }));
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("closes on Escape and via the scrim / close / cancel controls", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NewNodeModal {...baseProps({ onClose })} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    // The modal portals to <body>, so reach the scrim through document.
    await user.click(document.querySelector(".nl-modal-scrim")!);
    expect(onClose).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(3);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(4);
  });
});
