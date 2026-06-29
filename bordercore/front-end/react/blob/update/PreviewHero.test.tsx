import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";

import { PreviewHero } from "./PreviewHero";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PreviewHero create-mode drop zone", () => {
  it("accepts an image dragged from another browser tab (delivered as a URL, not a File)", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) })
    );

    const onFileSelected = vi.fn();
    const { container } = render(<PreviewHero mode="create" onFileSelected={onFileSelected} />);
    const zone = container.querySelector(".be-preview-drop")!;

    fireEvent.drop(zone, {
      dataTransfer: {
        files: [],
        getData: (type: string) =>
          type === "text/uri-list" ? "https://example.com/photo.png" : "",
      },
    });

    await waitFor(() => expect(onFileSelected).toHaveBeenCalledTimes(1));
    const file = onFileSelected.mock.calls[0][0] as File;
    expect(file.name).toBe("photo.png");
    expect(file.type).toBe("image/png");
  });

  it("still accepts a file dropped from the desktop", () => {
    const onFileSelected = vi.fn();
    const { container } = render(<PreviewHero mode="create" onFileSelected={onFileSelected} />);
    const zone = container.querySelector(".be-preview-drop")!;

    const file = new File([new Uint8Array([1])], "local.pdf", { type: "application/pdf" });
    fireEvent.drop(zone, { dataTransfer: { files: [file], getData: () => "" } });

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });
});
