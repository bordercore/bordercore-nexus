import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Imports from "./Imports";
import { api } from "./api";

vi.mock("./api", () => ({
  api: vi.fn(),
  errorText: () => "Unable to read this Apple Health ZIP.",
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

const preview = {
  uuid: "batch-one",
  committed: false,
  result: {},
  summary: [
    {
      kind: "weight",
      total: 3,
      new: 1,
      existing: 2,
      first_date: "2020-01-01",
      last_date: "2025-01-01",
      sources: ["Apple Health · Scale"],
    },
    {
      kind: "blood-pressure",
      total: 1,
      new: 1,
      existing: 0,
      first_date: "2025-01-01",
      last_date: "2025-01-01",
      sources: ["Apple Health · OMRON"],
    },
  ],
  warnings: { repeated_entries: 2, incomplete_pressure: 1, ambiguous_pressure: 0 },
  rows: [
    {
      kind: "weight",
      status: "new",
      data: {
        external_id: "health-one",
        date: "2025-01-01",
        time: "08:00:00",
        value: "180",
        unit: "lb",
        source: "Apple Health · Scale",
        timezone: "America/New_York",
      },
    },
  ],
};

async function chooseZip() {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Import format"), "apple-health");
  await user.upload(
    screen.getByLabelText("Apple Health ZIP file"),
    new File(["zip"], "export.zip", { type: "application/zip" })
  );
  // jsdom does not recognize user-event's uploaded FileList for required-file
  // validation. Exercise submission here; the browser smoke test clicks it.
  fireEvent.submit(
    screen.getByRole("button", { name: "Preview Apple Health import" }).closest("form")!
  );
  return user;
}

describe("Apple Health import", () => {
  it("previews both trackers, explains skips, and confirms the saved batch", async () => {
    vi.mocked(api).mockImplementation(async (url, method) => {
      if (method === "POST")
        return url.endsWith("/commit/") ? { imported: 2, skipped: 2 } : preview;
      return [];
    });
    const onSaved = vi.fn();
    render(<Imports root="/quantified-self/" onSaved={onSaved} />);
    const user = await chooseZip();
    expect(await screen.findByText(/2 repeated XML entries removed/)).toBeVisible();
    expect(screen.getByText(/Skipped 1 incomplete and 0 ambiguous/)).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Already imported" })).toBeVisible();
    expect(screen.queryByLabelText(/Import duplicate/)).not.toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(
      "/quantified-self/apple-health/import/",
      "POST",
      expect.any(FormData),
      expect.objectContaining({ onUploadProgress: expect.any(Function) })
    );
    expect(onSaved).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm Apple Health import" }));
    expect(
      await screen.findByText("Imported 2 readings; skipped 2 already imported readings.")
    ).toBeVisible();
    expect(api).toHaveBeenCalledWith("/quantified-self/imports/batch-one/commit/", "POST", {
      progress_id: expect.any(String),
    });
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("recognizes a repeated export and does not offer a second commit", async () => {
    vi.mocked(api).mockImplementation(async (_, method) =>
      method === "POST" ? { ...preview, committed: true, result: { imported: 2, skipped: 2 } } : []
    );
    render(<Imports root="/quantified-self/" onSaved={vi.fn()} />);
    await chooseZip();
    expect(await screen.findByText("These readings were already imported")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Confirm Apple Health import" })
    ).not.toBeInTheDocument();
  });

  it("keeps a failed upload available for retry", async () => {
    vi.mocked(api).mockImplementation(async (_, method) => {
      if (method === "POST") throw new Error("bad zip");
      return [];
    });
    render(<Imports root="/quantified-self/" onSaved={vi.fn()} />);
    await chooseZip();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to read this Apple Health ZIP."
    );
    expect(screen.getByRole("button", { name: "Preview Apple Health import" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Confirm Apple Health import" })
    ).not.toBeInTheDocument();
  });

  it("disables format changes while a ZIP is being processed", async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(api).mockImplementation((_, method) =>
      method === "POST"
        ? (new Promise(done => {
            resolve = done;
          }) as ReturnType<typeof api>)
        : (Promise.resolve([]) as ReturnType<typeof api>)
    );
    render(<Imports root="/quantified-self/" onSaved={vi.fn()} />);
    await chooseZip();
    expect(screen.getByLabelText("Import format")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Uploading ZIP");
    resolve(preview);
    await waitFor(() => expect(screen.getByLabelText("Import format")).toBeEnabled());
  });

  it("shows real upload and scan progress, then stops polling after preview", async () => {
    vi.useFakeTimers();
    let resolve!: (value: unknown) => void;
    let snapshot = {
      stage: "scanning",
      loaded: 50 * 1024 * 1024,
      total: 100 * 1024 * 1024,
      weight: 1328,
      blood_pressure: 400,
      duplicates: 840,
    };
    vi.mocked(api).mockImplementation((url, method) => {
      if (method === "POST")
        return new Promise(done => {
          resolve = done;
        }) as ReturnType<typeof api>;
      return Promise.resolve(url.includes("/progress/") ? snapshot : []) as ReturnType<typeof api>;
    });
    render(<Imports root="/quantified-self/" onSaved={vi.fn()} />);
    const input = screen.getByLabelText("Apple Health ZIP file");
    fireEvent.change(input, { target: { files: [new File(["zip"], "export.zip")] } });
    fireEvent.submit(input.closest("form")!);
    const upload = vi.mocked(api).mock.calls.find(call => call[1] === "POST")!;
    expect((upload[2] as FormData).get("progress_id")).toMatch(/^[a-f0-9-]{36}$/);
    act(() => upload[3]!.onUploadProgress!({ loaded: 25, total: 100 } as never));
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "25");
    expect(screen.getByRole("status")).toHaveTextContent("Uploading ZIP · 25%");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Scanning health records · 50%");
    expect(screen.getByRole("status")).toHaveTextContent(
      "1,328 weight readings · 400 blood-pressure pairs found"
    );
    expect(screen.getByRole("status")).toHaveTextContent("840 repeated entries");
    expect(screen.getByRole("status")).toHaveTextContent("1s elapsed");
    snapshot = { ...snapshot, stage: "checking" };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(750);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Checking for existing readings");
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("value");
    await act(async () => resolve(preview));
    const polls = vi.mocked(api).mock.calls.filter(call => call[0].includes("/progress/")).length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(vi.mocked(api).mock.calls.filter(call => call[0].includes("/progress/"))).toHaveLength(
      polls
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
