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
  vi.restoreAllMocks();
});

describe("video thumbnail capture", () => {
  function renderVideo() {
    const props = baseProps();
    const result = render(
      <BlobUpdatePage
        {...props}
        blobUuid="video-uuid"
        doctype="video"
        coverUrl="https://example.com/cover.jpg"
        urls={{ ...props.urls, download: "https://example.com/video.mp4" }}
      />
    );
    const capture = screen.getByRole("button", { name: "capture frame as thumbnail" });
    expect(capture).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Play video" }));
    const video = result.container.querySelector("video")!;
    Object.defineProperties(video, {
      videoWidth: { value: 1920 },
      videoHeight: { value: 1080 },
      readyState: { value: 2 },
    });
    const pause = vi.spyOn(video, "pause").mockImplementation(() => {});
    fireEvent.loadedData(video);
    return { capture, video, pause };
  }

  it("uploads the displayed frame as JPEG and refreshes the cover after saving", async () => {
    let completeUpload!: (response: { data: { cover_url: string } }) => void;
    axiosPost.mockReturnValue(
      new Promise<{ data: { cover_url: string } }>(resolve => {
        completeUpload = resolve;
      })
    );
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const image = new Blob(["frame"], { type: "image/jpeg" });
    const encode = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation(callback => callback(image));
    const { capture, video, pause } = renderVideo();
    expect(video.crossOrigin).toBe("anonymous");
    fireEvent.seeking(video);
    expect(capture).toBeDisabled();
    fireEvent.seeked(video);
    expect(capture).toBeEnabled();
    fireEvent.click(capture);
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
    expect(pause).toHaveBeenCalledOnce();
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080);
    expect(encode).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.95);
    const [url, data] = axiosPost.mock.calls[0];
    expect(url).toBe(baseProps().urls.updateCoverImage);
    expect(data.get("blob_uuid")).toBe("video-uuid");
    expect(data.get("image")).toMatchObject({ name: "video-frame.jpg", type: "image/jpeg" });
    expect(screen.getByRole("button", { name: "saving thumbnail…" })).toBeDisabled();
    completeUpload({ data: { cover_url: "https://example.com/cover.jpg?v=saved-version" } });
    await waitFor(() => expect(video.poster).toBe("https://example.com/cover.jpg?v=saved-version"));
    expect(emit).toHaveBeenCalledWith("toast", expect.objectContaining({ variant: "success" }));
  });

  it("reports upload failures and allows another capture", async () => {
    axiosPost.mockRejectedValue(new Error("Upload failed"));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback =>
      callback(new Blob(["frame"], { type: "image/jpeg" }))
    );
    const { capture, video } = renderVideo();
    fireEvent.click(capture);
    await waitFor(() =>
      expect(emit).toHaveBeenCalledWith(
        "toast",
        expect.objectContaining({
          variant: "danger",
          body: expect.stringContaining("Upload failed"),
        })
      )
    );
    expect(capture).toBeEnabled();
    expect(video.poster).toBe("https://example.com/cover.jpg");
  });

  it("reports canvas security errors without uploading", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(() => {
      throw new DOMException("Canvas is tainted", "SecurityError");
    });
    const { capture } = renderVideo();
    fireEvent.click(capture);
    await waitFor(() =>
      expect(emit).toHaveBeenCalledWith("toast", expect.objectContaining({ variant: "danger" }))
    );
    expect(axiosPost).not.toHaveBeenCalled();
    expect(capture).toBeEnabled();
  });

  it("does not offer frame capture for other blob types", () => {
    render(<BlobUpdatePage {...baseProps()} blobUuid="image-uuid" doctype="image" />);
    expect(screen.queryByRole("button", { name: "capture frame as thumbnail" })).toBeNull();
  });
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
