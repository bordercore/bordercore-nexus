import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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

  it("shows an error when the dragged image cannot be fetched", async () => {
    // Hosts that send no Access-Control-Allow-Origin can't be read from the
    // page, so the drop has to say so rather than silently do nothing.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const onFileSelected = vi.fn();
    const { container } = render(<PreviewHero mode="create" onFileSelected={onFileSelected} />);
    const zone = container.querySelector(".be-preview-drop")!;

    fireEvent.drop(zone, {
      dataTransfer: {
        files: [],
        getData: (type: string) =>
          type === "text/uri-list" ? "https://example.com/blocked.png" : "",
      },
    });

    expect(await screen.findByText(/Couldn't load that image/)).toBeTruthy();
    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it("clears a previous error once a later drop succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const onFileSelected = vi.fn();
    const { container } = render(<PreviewHero mode="create" onFileSelected={onFileSelected} />);
    const zone = container.querySelector(".be-preview-drop")!;
    const uriListOnly = {
      files: [] as File[],
      getData: (type: string) => (type === "text/uri-list" ? "https://example.com/x.png" : ""),
    };

    fireEvent.drop(zone, { dataTransfer: uriListOnly });
    await screen.findByText(/Couldn't load that image/);

    const file = new File([new Uint8Array([1])], "local.png", { type: "image/png" });
    fireEvent.drop(zone, { dataTransfer: { files: [file], getData: () => "" } });

    await waitFor(() => expect(screen.queryByText(/Couldn't load that image/)).toBeNull());
    expect(onFileSelected).toHaveBeenCalledWith(file);
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
