import { afterEach, describe, expect, it, vi } from "vitest";

import { extractImageUrl, fetchImageAsFile, isImageFile, parseUriList } from "./imageFile";

const file = (name: string, type: string) => new File([new Uint8Array([1, 2, 3])], name, { type });

function dataTransfer(data: Record<string, string>): DataTransfer {
  return { getData: (type: string) => data[type] ?? "" } as unknown as DataTransfer;
}

describe("extractImageUrl", () => {
  it("prefers the img src in text/html over text/uri-list", () => {
    // Dragging an image that sits inside a link — the norm on search results
    // and gallery pages — puts the link's page URL in text/uri-list. Only the
    // <img> in text/html names the image itself.
    const dt = dataTransfer({
      "text/uri-list": "https://commons.wikimedia.org/wiki/File:demo.png",
      "text/html": '<img src="https://upload.wikimedia.org/demo.png" alt="x">',
      "text/plain": "",
    });
    expect(extractImageUrl(dt)).toBe("https://upload.wikimedia.org/demo.png");
  });

  it("returns the first non-comment line of text/uri-list", () => {
    const dt = dataTransfer({
      "text/uri-list": "# comment\nhttps://example.com/a.jpg\nhttps://example.com/b.jpg",
    });
    expect(extractImageUrl(dt)).toBe("https://example.com/a.jpg");
  });

  it("falls back to the img src in text/html", () => {
    const dt = dataTransfer({
      "text/html": '<meta charset="utf-8"><img src="https://example.com/c.png" alt="x">',
    });
    expect(extractImageUrl(dt)).toBe("https://example.com/c.png");
  });

  it("falls back to an http(s) URL in text/plain", () => {
    const dt = dataTransfer({ "text/plain": "  https://example.com/d.webp  " });
    expect(extractImageUrl(dt)).toBe("https://example.com/d.webp");
  });

  it("returns null when no usable URL is present", () => {
    expect(extractImageUrl(dataTransfer({ "text/plain": "just some text" }))).toBeNull();
    expect(extractImageUrl(dataTransfer({}))).toBeNull();
  });
});

describe("isImageFile", () => {
  it("accepts an image identified by MIME type", () => {
    expect(isImageFile(file("photo.png", "image/png"))).toBe(true);
  });

  it("accepts an uppercase extension when the browser leaves MIME type empty", () => {
    // This is the drag-and-drop bug: some platforms report "" for image.JPG.
    expect(isImageFile(file("image.JPG", ""))).toBe(true);
  });

  it("accepts an uppercase extension regardless of MIME type", () => {
    expect(isImageFile(file("IMAGE.JPEG", ""))).toBe(true);
  });

  it("rejects a non-image file with a known MIME type", () => {
    expect(isImageFile(file("doc.pdf", "application/pdf"))).toBe(false);
  });

  it("rejects a non-image file with an empty MIME type", () => {
    expect(isImageFile(file("archive.zip", ""))).toBe(false);
  });
});

describe("parseUriList", () => {
  it("returns the first non-comment URL", () => {
    expect(parseUriList("# comment\nhttps://example.com/a.jpg\n")).toBe(
      "https://example.com/a.jpg"
    );
  });

  it("returns null for empty input", () => {
    expect(parseUriList("")).toBeNull();
  });
});

describe("fetchImageAsFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wraps a fetched image in a File named from the URL", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) })
    );

    const result = await fetchImageAsFile("https://example.com/path/DCP_0489.JPG");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("DCP_0489.JPG");
    expect(result!.type).toBe("image/jpeg");
  });

  it("strips a query string when deriving the filename", async () => {
    const blob = new Blob([new Uint8Array([1])], { type: "image/png" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) })
    );

    const result = await fetchImageAsFile("https://example.com/pic.png?sig=abc");
    expect(result!.name).toBe("pic.png");
  });

  it("returns null when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchImageAsFile("https://example.com/x.jpg")).toBeNull();
  });

  it("returns null when the fetch is blocked (CORS / network)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await fetchImageAsFile("https://example.com/x.jpg")).toBeNull();
  });

  it("returns null when the fetched content is not an image", async () => {
    const blob = new Blob(["<html>"], { type: "text/html" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) })
    );
    expect(await fetchImageAsFile("https://example.com/page")).toBeNull();
  });
});
