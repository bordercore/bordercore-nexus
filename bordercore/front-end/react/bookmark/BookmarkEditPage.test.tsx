import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const doGet = vi.fn();
const doPost = vi.fn();

vi.mock("../utils/reactUtils", () => ({
  doGet: (...args: unknown[]) => doGet(...args),
  doPost: (...args: unknown[]) => doPost(...args),
  getCsrfToken: () => "test-csrf-token",
  EventBus: { $emit: vi.fn() },
}));

import BookmarkEditPage from "./BookmarkEditPage";

function fields() {
  return [
    {
      name: "url",
      label: "Url",
      value: "https://example.com",
      type: "url" as const,
      required: true,
      errors: [] as string[],
    },
    {
      name: "name",
      label: "Name",
      value: "Example",
      type: "text" as const,
      required: true,
      errors: [] as string[],
    },
    {
      name: "note",
      label: "Note",
      value: "an existing note",
      type: "textarea" as const,
      errors: [] as string[],
    },
  ];
}

function baseProps(overrides: Partial<React.ComponentProps<typeof BookmarkEditPage>> = {}) {
  return {
    uuid: "11111111-1111-1111-1111-111111111111",
    formAction: "/bookmark/edit/11111111-1111-1111-1111-111111111111/",
    bookmarkName: "Example",
    fields: fields(),
    initialTags: ["alpha"],
    initialImportance: false,
    initialIsPinned: false,
    initialDaily: 0,
    created: "2026-01-12T10:00:00Z",
    modified: "2026-04-20T10:00:00Z",
    lastCheck: "2026-04-25T10:00:00Z",
    lastResponseCode: 200,
    backReferences: [],
    relatedNodes: [],
    urls: {
      tagSearch: "/tag/search/",
      relatedTags: "/tag/get_related_tags/",
      deleteBookmark: "/bookmark/delete/00000000-0000-0000-0000-000000000000/",
      bookmarkOverview: "/bookmark/",
    },
    ...overrides,
  };
}

beforeEach(() => {
  doGet.mockReset();
  doPost.mockReset();
  doGet.mockImplementation((_url, cb: (r: unknown) => void) => {
    cb({ data: [] });
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("BookmarkEditPage", () => {
  it("renders the breadcrumb, name, URL field, and metadata strip", () => {
    render(<BookmarkEditPage {...baseProps()} />);
    expect(screen.getByLabelText(/^url$/i)).toHaveValue("https://example.com");
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Example");
    expect(screen.getByLabelText("last check status")).toHaveTextContent(/OK 200/);
  });

  it("renders all three toggles with correct initial states", () => {
    render(
      <BookmarkEditPage
        {...baseProps({ initialImportance: true, initialIsPinned: false, initialDaily: 1 })}
      />
    );
    expect(screen.getByLabelText(/^important$/i)).toBeChecked();
    expect(screen.getByLabelText(/^pinned$/i)).not.toBeChecked();
    expect(screen.getByLabelText(/^daily$/i)).toBeChecked();
  });

  it("disables the open-in-new-tab button when URL is empty", async () => {
    const user = userEvent.setup();
    render(<BookmarkEditPage {...baseProps()} />);
    const openBtn = screen.getByRole("button", { name: /open in new tab/i });
    expect(openBtn).toBeEnabled();

    await user.clear(screen.getByLabelText(/^url$/i));
    expect(openBtn).toBeDisabled();
  });

  it("opens the URL in a new tab when the icon button is clicked", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<BookmarkEditPage {...baseProps()} />);
    await user.click(screen.getByRole("button", { name: /open in new tab/i }));

    expect(openSpy).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
    openSpy.mockRestore();
  });

  it("delete button mutates form action and submits", async () => {
    const user = userEvent.setup();
    render(<BookmarkEditPage {...baseProps()} />);

    const form = document.getElementById("bookmark-form") as HTMLFormElement;
    const submitSpy = vi.spyOn(form, "submit").mockImplementation(() => {});

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(form.getAttribute("action")).toBe(
      "/bookmark/delete/11111111-1111-1111-1111-111111111111/"
    );
    expect(submitSpy).toHaveBeenCalledTimes(1);
    submitSpy.mockRestore();
  });

  it("fetches related tags on mount with the initial tags", () => {
    render(<BookmarkEditPage {...baseProps()} />);
    expect(doGet).toHaveBeenCalledTimes(1);
    const [calledUrl] = doGet.mock.calls[0];
    expect(calledUrl).toContain("/tag/get_related_tags/");
    expect(calledUrl).toContain("tag_name=alpha");
    expect(calledUrl).toContain("doc_type=bookmark");
  });

  it("renders the back-references panel only when non-empty", () => {
    const { rerender } = render(<BookmarkEditPage {...baseProps()} />);
    expect(screen.queryByText(/back references/i)).not.toBeInTheDocument();

    rerender(
      <BookmarkEditPage
        {...baseProps({
          backReferences: [
            { uuid: "b1", type: "blob", name: "Some blob", url: "/blob/b1/", tags: [] },
          ],
        })}
      />
    );
    expect(screen.getByText(/back references/i)).toBeInTheDocument();
    expect(screen.getByText("Some blob")).toBeInTheDocument();
  });

  it("renders thumbnail panel only when thumbnailUrl is provided", () => {
    const { container, rerender } = render(<BookmarkEditPage {...baseProps()} />);
    expect(container.querySelectorAll("img")).toHaveLength(0);

    rerender(<BookmarkEditPage {...baseProps({ thumbnailUrl: "/static/thumb.png" })} />);
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThanOrEqual(1);
    expect(Array.from(imgs).some(img => img.getAttribute("src") === "/static/thumb.png")).toBe(
      true
    );
  });

  it("renders field-level errors in red when present", () => {
    const fieldsWithError = fields();
    fieldsWithError[0].errors = ["Already exists"];
    render(<BookmarkEditPage {...baseProps({ fields: fieldsWithError })} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i);
  });
});
