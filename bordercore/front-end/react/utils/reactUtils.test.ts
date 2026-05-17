import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";

vi.mock("axios", () => {
  const callable = vi.fn();
  return {
    default: Object.assign(callable, {
      get: vi.fn(),
      defaults: { xsrfCookieName: "", xsrfHeaderName: "" },
    }),
  };
});

import { doDelete, doGet, doPatch, doPost, doPut, EventBus, getCsrfToken } from "./reactUtils";

const mockedAxios = axios as unknown as ReturnType<typeof vi.fn> & {
  get: ReturnType<typeof vi.fn>;
};

function clearCookies() {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

function flush() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
  mockedAxios.mockReset();
  mockedAxios.get.mockReset();
  clearCookies();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getCsrfToken", () => {
  it("returns the csrftoken cookie value", () => {
    document.cookie = "csrftoken=tok-abc; path=/";
    expect(getCsrfToken()).toBe("tok-abc");
  });

  it("decodes URL-encoded cookie values", () => {
    document.cookie = "csrftoken=a%20b; path=/";
    expect(getCsrfToken()).toBe("a b");
  });

  it("picks csrftoken out of a cookie string with other cookies", () => {
    document.cookie = "sessionid=xyz; path=/";
    document.cookie = "csrftoken=tok-xyz; path=/";
    document.cookie = "theme=dark; path=/";
    expect(getCsrfToken()).toBe("tok-xyz");
  });

  it("returns an empty string when the cookie is missing", () => {
    expect(getCsrfToken()).toBe("");
  });
});

describe("EventBus", () => {
  it("emits events to registered listeners", () => {
    const handler = vi.fn();
    EventBus.$on("test-event", handler);
    EventBus.$emit("test-event", { hello: "world" });
    expect(handler).toHaveBeenCalledWith({ hello: "world" });
    EventBus.$off("test-event", handler);
  });

  it("fires $once handlers exactly once", () => {
    const handler = vi.fn();
    EventBus.$once("once-event", handler);
    EventBus.$emit("once-event", 1);
    EventBus.$emit("once-event", 2);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it("$off removes the listener", () => {
    const handler = vi.fn();
    EventBus.$on("off-event", handler);
    EventBus.$off("off-event", handler);
    EventBus.$emit("off-event");
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("doGet", () => {
  it("invokes the callback with the axios response on success", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { ok: true } });
    const cb = vi.fn();
    doGet("/api/thing/", cb);
    await flush();

    expect(mockedAxios.get).toHaveBeenCalledWith("/api/thing/", { responseType: "json" });
    expect(cb).toHaveBeenCalledWith({ data: { ok: true } });
  });

  it("forwards a custom responseType", async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: "raw" });
    doGet("/api/text/", vi.fn(), "", "text");
    await flush();
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/text/", { responseType: "text" });
  });

  it("emits a toast and swallows axios errors", async () => {
    mockedAxios.get.mockRejectedValueOnce({ message: "boom", response: undefined });
    const toast = vi.fn();
    EventBus.$on("toast", toast);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    doGet("/api/broken/", vi.fn(), "load failed");
    await flush();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "danger", body: "load failed: boom" })
    );
    errSpy.mockRestore();
    EventBus.$off("toast", toast);
  });

  it("prefers the server-supplied detail message when present", async () => {
    mockedAxios.get.mockRejectedValueOnce({
      message: "ignored",
      response: { data: { detail: "Permission denied" } },
    });
    const toast = vi.fn();
    EventBus.$on("toast", toast);
    vi.spyOn(console, "error").mockImplementation(() => {});

    doGet("/api/forbidden/", vi.fn(), "should be overridden");
    await flush();

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ body: "Permission denied" }));
    EventBus.$off("toast", toast);
  });
});

describe("doPost", () => {
  it("sends URL-encoded form data with CSRF token in header and body", async () => {
    document.cookie = "csrftoken=tok-1; path=/";
    mockedAxios.mockResolvedValueOnce({ data: {} });

    doPost("/api/save/", { foo: "bar", n: 42 }, vi.fn());
    await flush();

    expect(mockedAxios).toHaveBeenCalledTimes(1);
    const [url, opts] = mockedAxios.mock.calls[0];
    expect(url).toBe("/api/save/");
    expect(opts.method).toBe("POST");
    expect(opts.withCredentials).toBe(true);
    expect(opts.headers["X-CSRFToken"]).toBe("tok-1");

    const body = opts.data as URLSearchParams;
    expect(body.get("csrfmiddlewaretoken")).toBe("tok-1");
    expect(body.get("foo")).toBe("bar");
    expect(body.get("n")).toBe("42");
  });

  it("omits the CSRF token when no cookie is present", async () => {
    mockedAxios.mockResolvedValueOnce({ data: {} });
    doPost("/api/anon/", { x: "y" }, vi.fn());
    await flush();

    const [, opts] = mockedAxios.mock.calls[0];
    expect(opts.headers["X-CSRFToken"]).toBeUndefined();
    expect((opts.data as URLSearchParams).get("csrfmiddlewaretoken")).toBeNull();
  });

  it("emits a success toast when successMsg is provided", async () => {
    mockedAxios.mockResolvedValueOnce({ data: {} });
    const cb = vi.fn();
    const toast = vi.fn();
    EventBus.$on("toast", toast);

    doPost("/api/save/", {}, cb, "Saved!");
    await flush();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Success", body: "Saved!", variant: "info" })
    );
    expect(cb).toHaveBeenCalled();
    EventBus.$off("toast", toast);
  });

  it("does not emit a success toast when successMsg is empty", async () => {
    mockedAxios.mockResolvedValueOnce({ data: {} });
    const toast = vi.fn();
    EventBus.$on("toast", toast);

    doPost("/api/save/", {}, vi.fn());
    await flush();

    expect(toast).not.toHaveBeenCalled();
    EventBus.$off("toast", toast);
  });

  it("emits an error toast on failure", async () => {
    mockedAxios.mockRejectedValueOnce({ message: "network down", response: undefined });
    const toast = vi.fn();
    EventBus.$on("toast", toast);
    vi.spyOn(console, "error").mockImplementation(() => {});

    doPost("/api/save/", {}, vi.fn(), "ok", "save failed");
    await flush();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "danger", body: "network down" })
    );
    EventBus.$off("toast", toast);
  });
});

describe("doPut", () => {
  it("issues a PUT with form-encoded body and CSRF token", async () => {
    document.cookie = "csrftoken=tok-put; path=/";
    mockedAxios.mockResolvedValueOnce({ data: {} });

    doPut("/api/thing/1/", { name: "updated" }, vi.fn());
    await flush();

    const [url, opts] = mockedAxios.mock.calls[0];
    expect(url).toBe("/api/thing/1/");
    expect(opts.method).toBe("PUT");
    expect(opts.headers["X-CSRFToken"]).toBe("tok-put");
    expect((opts.data as URLSearchParams).get("name")).toBe("updated");
  });
});

describe("doPatch", () => {
  it("issues a PATCH with form-encoded body", async () => {
    document.cookie = "csrftoken=tok-patch; path=/";
    mockedAxios.mockResolvedValueOnce({ data: {} });

    doPatch("/api/thing/1/", { flag: true }, vi.fn());
    await flush();

    const [, opts] = mockedAxios.mock.calls[0];
    expect(opts.method).toBe("PATCH");
    expect(opts.headers["X-CSRFToken"]).toBe("tok-patch");
    expect((opts.data as URLSearchParams).get("flag")).toBe("true");
  });

  it("prefers the caller-supplied errorMsg on failure", async () => {
    mockedAxios.mockRejectedValueOnce({ message: "ignored", response: undefined });
    const toast = vi.fn();
    EventBus.$on("toast", toast);
    vi.spyOn(console, "error").mockImplementation(() => {});

    doPatch("/api/thing/1/", {}, vi.fn(), "", "could not patch");
    await flush();

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ body: "could not patch" }));
    EventBus.$off("toast", toast);
  });
});

describe("doDelete", () => {
  it("issues a DELETE with CSRF token in headers and body", async () => {
    document.cookie = "csrftoken=tok-del; path=/";
    mockedAxios.mockResolvedValueOnce({ data: {} });

    doDelete("/api/thing/1/", vi.fn());
    await flush();

    const [url, opts] = mockedAxios.mock.calls[0];
    expect(url).toBe("/api/thing/1/");
    expect(opts.method).toBe("DELETE");
    expect(opts.headers["X-CSRFToken"]).toBe("tok-del");
    expect((opts.data as URLSearchParams).get("csrfmiddlewaretoken")).toBe("tok-del");
  });

  it("emits a success toast when successMsg is provided", async () => {
    mockedAxios.mockResolvedValueOnce({ data: {} });
    const toast = vi.fn();
    EventBus.$on("toast", toast);

    doDelete("/api/thing/1/", vi.fn(), "Deleted!");
    await flush();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Deleted!", variant: "info" })
    );
    EventBus.$off("toast", toast);
  });
});
