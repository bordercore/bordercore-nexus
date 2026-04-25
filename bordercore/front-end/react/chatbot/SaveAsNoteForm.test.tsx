import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveAsNoteForm } from "./SaveAsNoteForm";

const baseProps = {
  defaultTitle: "default title",
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

describe("SaveAsNoteForm", () => {
  it("autofills the title from defaultTitle", () => {
    render(<SaveAsNoteForm {...baseProps} />);
    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    expect(titleInput.value).toBe("default title");
  });

  it("calls onSave with title and tags on submit", async () => {
    const onSave = vi.fn();
    render(<SaveAsNoteForm {...baseProps} onSave={onSave} />);

    const titleInput = screen.getByLabelText(/title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "my note");

    const tagsInput = screen.getByLabelText(/tags/i);
    await userEvent.type(tagsInput, "ai, foo");

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith({ title: "my note", tags: "ai, foo" });
  });

  it("does not call onSave when title is empty", async () => {
    const onSave = vi.fn();
    render(<SaveAsNoteForm {...baseProps} defaultTitle="" onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onCancel when cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(<SaveAsNoteForm {...baseProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel on Escape", async () => {
    const onCancel = vi.fn();
    render(<SaveAsNoteForm {...baseProps} onCancel={onCancel} />);
    const titleInput = screen.getByLabelText(/title/i);
    titleInput.focus();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });
});
