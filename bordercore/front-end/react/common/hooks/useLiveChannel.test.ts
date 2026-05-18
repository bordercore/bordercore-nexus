import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useLiveChannel } from "./useLiveChannel";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  url: string;
  readyState: number = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  close: () => void;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    this.close = vi.fn(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.(new CloseEvent("close", { code: 1000 }));
    });
  }

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  triggerMessage(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  triggerClose(code = 1006) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code }));
  }
}

describe("useLiveChannel", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as any).WebSocket = MockWebSocket;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens a websocket on mount and closes on unmount", () => {
    const onMessage = vi.fn();
    const { unmount } = renderHook(() => useLiveChannel("/ws/todos/", onMessage));
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toMatch(/\/ws\/todos\/$/);
    unmount();
    expect(MockWebSocket.instances[0].close).toHaveBeenCalled();
  });

  it("invokes onMessage when a JSON message arrives", () => {
    const onMessage = vi.fn();
    renderHook(() => useLiveChannel("/ws/todos/", onMessage));
    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      MockWebSocket.instances[0].triggerMessage({ type: "ping" });
    });
    expect(onMessage).toHaveBeenCalledWith({ type: "ping" });
  });

  it("reconnects with exponential backoff after an unclean close", () => {
    const onMessage = vi.fn();
    renderHook(() => useLiveChannel("/ws/todos/", onMessage));
    act(() => MockWebSocket.instances[0].triggerClose(1006));
    expect(MockWebSocket.instances).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(MockWebSocket.instances).toHaveLength(2);
    act(() => MockWebSocket.instances[1].triggerClose(1006));
    act(() => vi.advanceTimersByTime(2000));
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it("does not reconnect after a 4401 (auth) close", () => {
    const onMessage = vi.fn();
    renderHook(() => useLiveChannel("/ws/todos/", onMessage));
    act(() => MockWebSocket.instances[0].triggerClose(4401));
    act(() => vi.advanceTimersByTime(60000));
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
