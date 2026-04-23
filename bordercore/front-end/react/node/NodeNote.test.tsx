import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../utils/reactUtils", () => ({
  doGet: vi.fn(),
  doPost: vi.fn(),
  doPut: vi.fn(),
  EventBus: { $on: vi.fn(), $once: vi.fn(), $off: vi.fn(), $emit: vi.fn() },
}));

import { doGet, doPost, doPut } from "../utils/reactUtils";
import NodeNote from "./NodeNote";
import type { NoteLayoutItem } from "./types";

const noteInitial: NoteLayoutItem = {
  type: "note",
  uuid: "note-uuid",
  name: "Inbox",
  color: 2,
};

const baseProps = {
  nodeUuid: "node-uuid",
  noteInitial,
  noteUrl: "/api/note/note-uuid/",
  setNoteColorUrl: "/api/note/color/",
  deleteNoteUrl: "/api/note/delete/",
  onOpenNoteMetadataModal: vi.fn(),
  onEditLayout: vi.fn(),
};

function renderWithContent(content: string | null = "Hello **world**") {
  (doGet as Mock).mockImplementation((_url: string, cb: (r: unknown) => void) => {
    cb({ data: { uuid: "note-uuid", name: "Inbox", content } });
  });
  return render(<NodeNote {...baseProps} />);
}

beforeEach(() => {
  (doGet as Mock).mockReset();
  (doPost as Mock).mockReset();
  (doPut as Mock).mockReset();
});

describe("NodeNote", () => {
  it("fetches the note from noteUrl on mount", () => {
    renderWithContent();
    expect(doGet).toHaveBeenCalledTimes(1);
    expect((doGet as Mock).mock.calls[0][0]).toBe("/api/note/note-uuid/");
  });

  it("renders the note name in the title slot", () => {
    renderWithContent();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
  });

  it("renders the markdown content as HTML", () => {
    const { container } = renderWithContent("Hello **world**");
    expect(container.querySelector(".node-note strong")?.textContent).toBe("world");
  });

  it("shows the empty-state placeholder when content is empty", () => {
    renderWithContent("");
    expect(screen.getByText(/no content/i)).toBeInTheDocument();
  });

  it("applies the color-preview override when provided", () => {
    (doGet as Mock).mockImplementation((_url, cb) => {
      cb({ data: { uuid: "note-uuid", name: "Inbox", content: "" } });
    });
    const { container } = render(<NodeNote {...baseProps} colorPreview={4} />);
    expect(container.querySelector(".card")?.className).toMatch(/node-color-4/);
  });

  it("switches to an editable input when the name is double-clicked", async () => {
    const user = userEvent.setup();
    renderWithContent();
    await user.dblClick(screen.getByText("Inbox"));
    expect(screen.getByRole("textbox")).toHaveValue("Inbox");
  });

  it("switches to editable content when the rendered markdown is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderWithContent("Hello");
    await user.click(container.querySelector(".node-note .cursor-pointer")!);
    expect(screen.getByRole("textbox")).toHaveValue("Hello");
  });

  it("posts to deleteNoteUrl and forwards the new layout when Delete is clicked", async () => {
    const onEditLayout = vi.fn();
    const user = userEvent.setup();
    (doGet as Mock).mockImplementation((_url, cb) => {
      cb({ data: { uuid: "note-uuid", name: "Inbox", content: "x" } });
    });
    const { container } = render(<NodeNote {...baseProps} onEditLayout={onEditLayout} />);
    await user.click(container.querySelector(".dropdown-trigger")!);
    await user.click(await screen.findByText(/delete note/i));

    const [url, payload, callback] = (doPost as Mock).mock.calls[0];
    expect(url).toBe("/api/note/delete/");
    expect(payload).toEqual({ node_uuid: "node-uuid", note_uuid: "note-uuid" });
    callback({ data: { layout: "[[],[],[]]" } });
    expect(onEditLayout).toHaveBeenCalledWith("[[],[],[]]");
  });

  it("persists content on blur via doPut", async () => {
    const user = userEvent.setup();
    const { container } = renderWithContent("initial");
    await user.click(container.querySelector(".node-note .cursor-pointer")!);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, "updated");
    textarea.blur();

    expect(doPut).toHaveBeenCalled();
    const [url, payload] = (doPut as Mock).mock.calls.at(-1)!;
    expect(url).toBe("/api/note/note-uuid/");
    expect(payload).toMatchObject({
      uuid: "note-uuid",
      name: "Inbox",
      content: "updated",
      is_note: "true",
    });
  });
});
