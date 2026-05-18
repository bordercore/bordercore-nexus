import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodoListPage } from "./TodoListPage";

// Capture the latest onMessage callback so tests can fire pings.
let lastOnMessage: ((msg: unknown) => void) | null = null;
vi.mock("../common/hooks/useLiveChannel", () => ({
  useLiveChannel: (_path: string, cb: (msg: unknown) => void) => {
    lastOnMessage = cb;
  },
}));

// Mock axios so the initial fetchTodos call resolves without a real server.
const axiosGet = vi.fn();
vi.mock("axios", () => {
  const mock = Object.assign(vi.fn(), {
    get: (...args: unknown[]) => axiosGet(...args),
    defaults: { xsrfCookieName: "", xsrfHeaderName: "", withCredentials: false },
  });
  return { default: mock };
});

vi.mock("../utils/reactUtils", () => ({
  doPost: vi.fn(),
  doDelete: vi.fn(),
  EventBus: { $emit: vi.fn() },
}));

const emptyResponse = {
  data: {
    todo_list: [],
    priority_counts: [],
    created_counts: [],
  },
};

function baseProps(): React.ComponentProps<typeof TodoListPage> {
  return {
    getTasksUrl: "/todo/get_tasks/",
    sortUrl: "/todo/sort/",
    moveToTopUrl: "/todo/move_to_top/",
    editTodoUrl: "/todo/00000000-0000-0000-0000-000000000000/edit/",
    createTodoUrl: "/todo/create/",
    tagSearchUrl: "/tag/search/?q=",
    storeInSessionUrl: "/todo/store_in_session/",
    priorityList: [
      [1, "High"],
      [2, "Normal"],
      [3, "Low"],
    ],
    tags: [],
    initialFilters: { tag: "", priority: "", time: "" },
    defaultSort: { field: "sort_order", direction: "asc" },
    initialViewType: "normal",
  };
}

beforeEach(() => {
  axiosGet.mockResolvedValue(emptyResponse);
  lastOnMessage = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("TodoListPage", () => {
  it("renders the new-todo button", async () => {
    render(<TodoListPage {...baseProps()} />);
    expect(screen.getByRole("button", { name: /new/i })).toBeInTheDocument();
  });
});

describe("TodoListPage live updates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    axiosGet.mockResolvedValue(emptyResponse);
    lastOnMessage = null;
  });
  afterEach(() => vi.useRealTimers());

  it("refetches todos when a ping arrives (debounced)", async () => {
    render(<TodoListPage {...baseProps()} />);

    // Wait for the initial fetchTodos call (from useEffect on mount).
    const callsBefore = axiosGet.mock.calls.length;

    // Fire 3 pings within 50 ms — should collapse to one refetch after 200 ms.
    lastOnMessage?.({ type: "ping" });
    vi.advanceTimersByTime(20);
    lastOnMessage?.({ type: "ping" });
    vi.advanceTimersByTime(20);
    lastOnMessage?.({ type: "ping" });
    vi.advanceTimersByTime(200);

    expect(axiosGet.mock.calls.length).toBe(callsBefore + 1);
  });
});
