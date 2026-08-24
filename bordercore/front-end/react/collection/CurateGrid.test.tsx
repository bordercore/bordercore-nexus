import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CurateGrid } from "./CurateGrid";
import type { CollectionObject } from "./types";

const object: CollectionObject = {
  uuid: "11111111-1111-1111-1111-111111111111",
  name: "Existing image",
  url: "/blob/11111111-1111-1111-1111-111111111111/",
  edit_url: "/blob/11111111-1111-1111-1111-111111111111/update/",
  type: "blob",
  cover_url: "/media/existing.png",
  cover_url_large: "/media/existing-large.png",
  tags: [],
};

function renderGrid(onFileDrop = vi.fn()) {
  const result = render(
    <CurateGrid
      objects={[object]}
      columns={4}
      shuffled={false}
      hasMore={false}
      loadingInitial={false}
      loadingMore={false}
      activeTag={null}
      onReorder={vi.fn()}
      onLoadMore={vi.fn()}
      onThumbClick={vi.fn()}
      onRemove={vi.fn()}
      onTagClick={vi.fn()}
      onFileDrop={onFileDrop}
      onClearFilter={vi.fn()}
      onAdd={vi.fn()}
    />
  );
  return { ...result, onFileDrop };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CurateGrid image drops", () => {
  it("fetches an image URL dragged from another webpage and uploads it as a File", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) })
    );
    const { container, onFileDrop } = renderGrid();

    fireEvent.drop(container.querySelector(".cd-grid")!, {
      dataTransfer: {
        files: [],
        getData: (type: string) =>
          type === "text/html"
            ? '<a href="https://example.com/page"><img src="https://cdn.example.com/photo.png"></a>'
            : "",
      },
    });

    await waitFor(() => expect(onFileDrop).toHaveBeenCalledTimes(1));
    const file = onFileDrop.mock.calls[0][0][0] as File;
    expect(file.name).toBe("photo.png");
    expect(file.type).toBe("image/png");
  });

  it("shows an explanation when the source site blocks the image fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { container, onFileDrop } = renderGrid();

    fireEvent.drop(container.querySelector(".cd-grid")!, {
      dataTransfer: {
        files: [],
        getData: (type: string) =>
          type === "text/uri-list" ? "https://example.com/blocked.png" : "",
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/source site may block/i);
    expect(onFileDrop).not.toHaveBeenCalled();
  });

  it("continues to accept local files", () => {
    const { container, onFileDrop } = renderGrid();
    const file = new File([new Uint8Array([1])], "local.png", { type: "image/png" });

    fireEvent.drop(container.querySelector(".cd-grid")!, {
      dataTransfer: { files: [file], getData: () => "" },
    });

    expect(onFileDrop).toHaveBeenCalledWith([file]);
  });
});
