import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import axios from "axios";

import { useConstellationData } from "./useConstellationData";
import type { GraphPayload, Layer } from "./types";

vi.mock("axios");

const mockedAxios = vi.mocked(axios);

function Harness({ url, layers }: { url: string; layers: Set<Layer> }) {
  const { status, data, error } = useConstellationData(url, layers);
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="node-count">{data ? data.nodes.length : "-"}</div>
      <div data-testid="error">{error ?? "-"}</div>
    </div>
  );
}

const sampleResponse: GraphPayload = {
  nodes: [{ uuid: "a", type: "blob", name: "A", detail_url: "/a/", degree: 0 }],
  edges: [],
};

beforeEach(() => {
  mockedAxios.get.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useConstellationData", () => {
  it("starts in loading state and transitions to ready", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: sampleResponse });

    render(<Harness url="/api/graph/" layers={new Set<Layer>(["direct", "tags"])} />);

    expect(screen.getByTestId("status").textContent).toBe("loading");

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });
    expect(screen.getByTestId("node-count").textContent).toBe("1");
  });

  it("calls the endpoint with the layers query param", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: sampleResponse });

    render(
      <Harness url="/api/graph/" layers={new Set<Layer>(["direct", "tags", "collections"])} />
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalled();
    });
    const calledUrl = mockedAxios.get.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/graph/");
    expect(calledUrl).toContain("layers=");
    expect(calledUrl).toContain("collections");
  });

  it("surfaces an error when the request fails", async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error("boom"));

    render(<Harness url="/api/graph/" layers={new Set<Layer>(["direct", "tags"])} />);

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("error");
    });
    expect(screen.getByTestId("error").textContent).toBe("boom");
  });

  it("refetches when the layers set changes", async () => {
    mockedAxios.get.mockResolvedValue({ data: sampleResponse });

    const { rerender } = render(
      <Harness url="/api/graph/" layers={new Set<Layer>(["direct", "tags"])} />
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    rerender(
      <Harness url="/api/graph/" layers={new Set<Layer>(["direct", "tags", "collections"])} />
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });
});
