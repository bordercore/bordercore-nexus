import { describe, expect, it } from "vitest";
import { extractImageUrl } from "./ArtistDetailPage";

function dataTransfer(data: Record<string, string>): DataTransfer {
  return { getData: (type: string) => data[type] ?? "" } as unknown as DataTransfer;
}

describe("extractImageUrl", () => {
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
