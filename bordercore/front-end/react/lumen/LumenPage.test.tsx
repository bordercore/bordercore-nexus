import React from "react";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LumenPage from "./LumenPage";

const question = "11111111-2222-4333-8444-555555555555";
const config = {
  enabled: true,
  settings: { provider: "anthropic", model: "example-model", style: "midnight-scholar" },
  providers: { anthropic: { label: "Anthropic", configured: true } },
};
const detail = {
  id: "lesson-1",
  question_uuid: question,
  title: "Pressure playground",
  summary: "Explore pressure",
  provider: "anthropic",
  model: "example-model",
  created_at: "2026-10-06T12:00:00Z",
  source: { question: "Why?", answer: "Because." },
  can_regenerate: true,
  source_changed: false,
  html_url: "/lumen/lessons/lesson-1/html/",
};
const fetchMock = vi.fn();
let theme = "midnight-scholar";
let accuracy: {
  status: string;
  explanation: string;
  question: string | null;
  answer: string | null;
} | null = null;
let correctionApplied = false;
let sourceChanged = false;
beforeEach(() => {
  window.history.replaceState(null, "", "/lumen/");
  sessionStorage.clear();
  fetchMock.mockReset();
  theme = "midnight-scholar";
  accuracy = null;
  correctionApplied = false;
  sourceChanged = false;
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(async (url: string) => {
    let data: unknown = {};
    if (url.endsWith("preferences/"))
      data = { ...config, settings: { ...config.settings, style: theme } };
    else if (url.includes("models/"))
      data = {
        models: [
          { id: "example-model", name: "Sonnet example" },
          { id: "opus-example", name: "Opus example" },
          { id: "haiku-example", name: "Haiku example" },
        ],
      };
    else if (url.endsWith("jobs/")) data = { jobs: [] };
    else if (url.includes("jobs/remembered/"))
      data = { id: "remembered", status: "complete", lesson_id: "lesson-1" };
    else if (url.includes("versions/")) data = { versions: [detail] };
    else if (url.endsWith("correct-source/")) {
      correctionApplied = true;
      data = { detail: "Corrected" };
    } else if (url.endsWith("check-accuracy/")) data = { job_id: "new-job" };
    else if (url.includes("lessons/lesson-1/"))
      data = {
        ...detail,
        accuracy,
        correction_applied: correctionApplied,
        source_changed: sourceChanged,
      };
    else if (url.includes("lessons/?")) data = { lessons: [], count: 0, has_next: false };
    else if (url.endsWith("generate/")) data = { job_id: "new-job" };
    else if (url.includes("jobs/new-job/"))
      data = { id: "new-job", status: "generating", message: "Designing lesson…" };
    return { ok: true, json: async () => data };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mount() {
  return render(
    <LumenPage api="/lumen/api/" prefsUrl="/accounts/prefs/" storageKey="lumen-user" />
  );
}
it("opens the saved lesson from a drill link without generating", async () => {
  window.history.replaceState(null, "", `/lumen/?question=${question}`);
  const { container } = mount();
  await screen.findByRole("heading", { name: "Pressure playground" });
  const frame = container.querySelector("iframe")!;
  expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
  expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(fetchMock.mock.calls.some(([url]) => url.includes("generate/"))).toBe(false);
});
it("reconnects to a job completed while the tab was reloading", async () => {
  sessionStorage.setItem("lumen-user", JSON.stringify(["remembered"]));
  mount();
  await screen.findByRole("heading", { name: "Pressure playground" });
  await waitFor(() => expect(sessionStorage.getItem("lumen-user")).toBe("[]"));
});
it("submits the UUID with CSRF only after an explicit click", async () => {
  document.cookie = "csrftoken=test-csrf; path=/";
  mount();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Create lesson ↗" })).toBeEnabled()
  );
  fireEvent.change(screen.getByLabelText("Drill question UUID"), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Create lesson ↗" }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      "/lumen/api/generate/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ uuid: question }),
        headers: expect.objectContaining({ "X-CSRFToken": "test-csrf" }),
      })
    )
  );
  expect(screen.getByRole("button", { name: "Create lesson ↗" })).toBeDisabled();
});
it("reloads the frame after the independent theme changes without regenerating", async () => {
  window.history.replaceState(null, "", "/lumen/#lesson-1");
  const { container } = mount();
  await screen.findByRole("heading", { name: "Pressure playground" });
  const oldFrame = container.querySelector("iframe");
  theme = "neon-circuit";
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(container.querySelector("iframe")).not.toBe(oldFrame));
  expect(fetchMock.mock.calls.some(([url]) => url.includes("generate/"))).toBe(false);
});

it("shows other model families while a model is selected and supports custom IDs", async () => {
  mount();
  fireEvent.click(screen.getByText(/Generation settings ·/));
  await waitFor(() => expect(screen.getByLabelText("Model")).toHaveValue("example-model"));
  expect(
    await screen.findByRole("option", { name: "Opus example (opus-example)" })
  ).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Haiku example (haiku-example)" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Model"), { target: { value: "opus-example" } });
  fireEvent.click(screen.getByRole("button", { name: "Save generation settings" }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      "/lumen/api/preferences/",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ provider: "anthropic", model: "opus-example" }),
      })
    )
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save generation settings" })).toBeEnabled()
  );
  fireEvent.change(screen.getByLabelText("Model"), { target: { value: "__custom__" } });
  fireEvent.change(screen.getByLabelText("Custom model ID"), { target: { value: "custom/model" } });
  fireEvent.click(screen.getByRole("button", { name: "Save generation settings" }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      "/lumen/api/preferences/",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ provider: "anthropic", model: "custom/model" }),
      })
    )
  );
});

it("previews the correction and applies it only on click", async () => {
  window.history.replaceState(null, "", "/lumen/#lesson-1");
  accuracy = {
    status: "issues",
    explanation: "The formula is incorrect.",
    question: "What is pressure?",
    answer: "P = F / A",
  };
  mount();
  await screen.findByText("P = F / A");
  expect(fetchMock.mock.calls.some(([url]) => url.includes("correct-source/"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Correct original question and answer" }));
  await screen.findByText("Correction applied to the original drill.");
  expect(fetchMock).toHaveBeenCalledWith(
    "/lumen/api/lessons/lesson-1/correct-source/",
    expect.objectContaining({ method: "POST", body: "{}" })
  );
});

it("does not offer automatic correction for uncertainty or an accurate source", async () => {
  window.history.replaceState(null, "", "/lumen/#lesson-1");
  accuracy = {
    status: "uncertain",
    explanation: "More context is needed.",
    question: null,
    answer: null,
  };
  mount();
  await screen.findByText("More context is needed.");
  expect(
    screen.queryByRole("button", { name: "Correct original question and answer" })
  ).not.toBeInTheDocument();
});

it("disables a saved correction when the original source changed", async () => {
  window.history.replaceState(null, "", "/lumen/#lesson-1");
  accuracy = { status: "issues", explanation: "Incorrect", question: "Q", answer: "A" };
  sourceChanged = true;
  mount();
  expect(
    await screen.findByRole("button", { name: "Correct original question and answer" })
  ).toBeDisabled();
});

it("can prepare an accuracy assessment for an older lesson", async () => {
  window.history.replaceState(null, "", "/lumen/#lesson-1");
  mount();
  const button = await screen.findByRole("button", { name: "Check accuracy" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      "/lumen/api/lessons/lesson-1/check-accuracy/",
      expect.objectContaining({ method: "POST" })
    )
  );
});
