import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReminderFormState } from "./ReminderFormBody";
import { submitDeleteReminder, submitReminderForm } from "./reminderSubmit";

vi.mock("axios");

const mockedAxios = vi.mocked(axios);

function makeState(overrides: Partial<ReminderFormState> = {}): ReminderFormState {
  return {
    name: "Take vitamins",
    note: "",
    is_active: true,
    create_todo: false,
    schedule_type: "daily",
    trigger_time: "09:00",
    days_of_week: [],
    days_of_month: [],
    start_at: "",
    ...overrides,
  };
}

function clearAllCookies(): void {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

beforeEach(() => {
  mockedAxios.post.mockReset();
  clearAllCookies();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("submitReminderForm", () => {
  it("returns { success: true } when the server confirms success", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
    const result = await submitReminderForm("/save/", makeState());
    expect(result).toEqual({ success: true });
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it("posts form-encoded body with required scalar fields", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await submitReminderForm(
      "/save/",
      makeState({ name: "Pay bills", note: "monthly", is_active: false, create_todo: true })
    );

    const [url, body, config] = mockedAxios.post.mock.calls[0];
    expect(url).toBe("/save/");
    expect(body).toBeInstanceOf(URLSearchParams);
    const params = body as URLSearchParams;
    expect(params.get("name")).toBe("Pay bills");
    expect(params.get("note")).toBe("monthly");
    expect(params.get("is_active")).toBe("false");
    expect(params.get("create_todo")).toBe("true");
    expect(params.get("schedule_type")).toBe("daily");
    expect(params.get("trigger_time")).toBe("09:00");
    expect(params.get("days_of_week_input")).toBe("[]");
    expect(params.get("days_of_month_input")).toBe("[]");
    // Legacy interval fields are always sent so the server form validates.
    expect(params.get("interval_value")).toBe("1");
    expect(params.get("interval_unit")).toBe("day");
    expect(config?.headers?.["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(config?.headers?.["X-Requested-With"]).toBe("XMLHttpRequest");
    expect(config?.withCredentials).toBe(true);
  });

  it("JSON-encodes days_of_week and days_of_month arrays", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await submitReminderForm(
      "/save/",
      makeState({ days_of_week: [0, 2, 4], days_of_month: [1, 15] })
    );

    const params = mockedAxios.post.mock.calls[0][1] as URLSearchParams;
    expect(params.get("days_of_week_input")).toBe("[0,2,4]");
    expect(params.get("days_of_month_input")).toBe("[1,15]");
  });

  it("omits trigger_time when empty", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await submitReminderForm("/save/", makeState({ trigger_time: "" }));

    const params = mockedAxios.post.mock.calls[0][1] as URLSearchParams;
    expect(params.has("trigger_time")).toBe(false);
  });

  it("converts start_at to an ISO timestamp when provided", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await submitReminderForm("/save/", makeState({ start_at: "2026-05-15T09:00" }));

    const params = mockedAxios.post.mock.calls[0][1] as URLSearchParams;
    const startAt = params.get("start_at");
    expect(startAt).toBeTruthy();
    // ISO 8601 with "Z" suffix
    expect(startAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z$/);
  });

  it("attaches the CSRF token from the csrftoken cookie", async () => {
    document.cookie = "csrftoken=abc123";
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await submitReminderForm("/save/", makeState());

    const config = mockedAxios.post.mock.calls[0][2];
    expect(config?.headers?.["X-CSRFToken"]).toBe("abc123");
  });

  it("omits the CSRF header when the cookie is absent", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await submitReminderForm("/save/", makeState());

    const config = mockedAxios.post.mock.calls[0][2];
    expect(config?.headers?.["X-CSRFToken"]).toBeUndefined();
  });

  it("returns server-supplied field errors", async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { errors: { name: ["This field is required."] } } },
    });

    const result = await submitReminderForm("/save/", makeState());

    expect(result.success).toBe(false);
    expect(result.errors).toEqual({ name: ["This field is required."] });
  });

  it("converts Django-style array-valued errors into the errors map", async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: {
        data: {
          name: ["Required."],
          trigger_time: ["Invalid time."],
          // Non-array values should be ignored.
          __all__: "ignored",
        },
      },
    });

    const result = await submitReminderForm("/save/", makeState());

    expect(result.success).toBe(false);
    expect(result.errors).toEqual({
      name: ["Required."],
      trigger_time: ["Invalid time."],
    });
  });

  it("falls back to err.message when no structured errors are returned", async () => {
    mockedAxios.post.mockRejectedValueOnce({ message: "Network down" });

    const result = await submitReminderForm("/save/", makeState());

    expect(result).toEqual({ success: false, message: "Network down" });
  });

  it("returns a generic message when the server response is not { success: true }", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: false } });

    const result = await submitReminderForm("/save/", makeState());

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unexpected/i);
  });
});

describe("submitDeleteReminder", () => {
  it("posts to the delete URL and returns success", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    const result = await submitDeleteReminder("/reminder/abc/delete/");

    expect(result).toEqual({ success: true });
    const [url, body, config] = mockedAxios.post.mock.calls[0];
    expect(url).toBe("/reminder/abc/delete/");
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(config?.headers?.["X-Requested-With"]).toBe("XMLHttpRequest");
  });

  it("includes the CSRF token when the cookie is set", async () => {
    document.cookie = "csrftoken=xyz789";
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    await submitDeleteReminder("/reminder/abc/delete/");

    const config = mockedAxios.post.mock.calls[0][2];
    expect(config?.headers?.["X-CSRFToken"]).toBe("xyz789");
  });

  it("returns the error message on failure", async () => {
    mockedAxios.post.mockRejectedValueOnce({ message: "boom" });

    const result = await submitDeleteReminder("/reminder/abc/delete/");

    expect(result).toEqual({ success: false, message: "boom" });
  });
});
