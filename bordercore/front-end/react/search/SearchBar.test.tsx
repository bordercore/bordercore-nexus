import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SearchBar } from "./SearchBar";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderImageSearch() {
  const { container } = render(
    <SearchBar
      searchMode="image"
      tagsChangedUrl="/tags/changed"
      tagSearchUrl="/search/tag"
      termSearchUrl="/search/term"
    />
  );
  return container.querySelector(".image-search-form__drop-zone")!;
}

describe("SearchBar image drop zone", () => {
  it("uses the img src from text/html when the dragged image sits inside a link", async () => {
    // Dragging a linked image — the norm on search results and gallery pages —
    // puts the link's page URL in text/uri-list, so only text/html names the
    // image itself.
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    vi.stubGlobal("fetch", fetchMock);

    const zone = renderImageSearch();
    fireEvent.drop(zone, {
      dataTransfer: {
        files: [],
        getData: (type: string) =>
          ({
            "text/uri-list": "https://commons.example.org/wiki/File:photo.png",
            "text/html": '<img src="https://cdn.example.org/photo.png" alt="x">',
          })[type] ?? "",
      },
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("https://cdn.example.org/photo.png")
    );
    expect(await screen.findByText("photo.png")).toBeTruthy();
  });

  it("shows an error when the dragged image cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const zone = renderImageSearch();
    fireEvent.drop(zone, {
      dataTransfer: {
        files: [],
        getData: (type: string) =>
          type === "text/uri-list" ? "https://example.com/blocked.png" : "",
      },
    });

    expect(await screen.findByText(/Couldn't load that image/)).toBeTruthy();
  });

  it("still accepts an image file dragged from the file manager", () => {
    const zone = renderImageSearch();
    const file = new File([new Uint8Array([1])], "local.png", { type: "image/png" });

    fireEvent.drop(zone, { dataTransfer: { files: [file], getData: () => "" } });

    expect(screen.getByText("local.png")).toBeTruthy();
  });
});
