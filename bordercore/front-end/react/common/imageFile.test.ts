import { describe, expect, it } from "vitest";

import { isImageFile } from "./imageFile";

const file = (name: string, type: string) => new File([new Uint8Array([1, 2, 3])], name, { type });

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
