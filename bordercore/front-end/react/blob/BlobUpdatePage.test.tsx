import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BlobUpdatePage } from "./BlobUpdatePage";

// Mock axios so submit can be made to reject with a backend error response.
const axiosPost = vi.fn();
vi.mock("axios", () => {
  const mock = Object.assign(vi.fn(), {
    post: (...args: unknown[]) => axiosPost(...args),
    get: vi.fn(),
    defaults: { xsrfCookieName: "", xsrfHeaderName: "", withCredentials: false },
  });
  return { default: mock };
});

// Capture toast emissions; stub the rest of reactUtils used by the page.
const emit = vi.fn();
vi.mock("../utils/reactUtils", () => ({
  EventBus: { $emit: (...args: unknown[]) => emit(...args) },
  doGet: vi.fn(),
  doPost: vi.fn(),
}));

// The markdown editor pulls in a heavy editor; stub it to a no-op handle.
vi.mock("./MarkdownEditor", () => ({
  MarkdownEditor: () => null,
}));

function baseProps(): React.ComponentProps<typeof BlobUpdatePage> {
  return {
    initialName: "",
    initialDate: "",
    initialDateFormat: "standard",
    initialContent: "",
    initialTags: [],
    initialNote: "",
    initialImportance: false,
    initialIsNote: false,
    initialIsBook: false,
    initialMathSupport: false,
    initialFileName: "test.pdf",
    initialMetadata: [],
    templateList: [],
    urls: {
      submit: "/blob/create/",
      tagSearch: "/tag/search/?q=",
      metadataNameSearch: "/blob/metadata_name_search/?q=",
      getTemplate: "/blob/template/",
      updateCoverImage: "/blob/update_cover_image/",
      updatePageNumber: "/blob/update_page_number/",
      parseDate: "/blob/parse_date/",
      blobDetail: "/blob/00000000-0000-0000-0000-000000000000/",
      list: "/blob/",
      detail: "/blob/",
    },
  };
}

beforeEach(() => {
  emit.mockClear();
  axiosPost.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("BlobUpdatePage submit errors", () => {
  it("shows the backend `detail` message when submission is rejected", async () => {
    axiosPost.mockRejectedValue({
      response: { data: { detail: "Error: This file already exists." } },
      message: "Request failed with status code 400",
    });

    render(<BlobUpdatePage {...baseProps()} />);

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(emit).toHaveBeenCalled());

    const toast = emit.mock.calls.find(([event]) => event === "toast");
    expect(toast).toBeTruthy();
    expect(toast?.[1]).toMatchObject({
      body: "Error: This file already exists.",
      variant: "danger",
    });
  });
});
