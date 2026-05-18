import { useEffect, useRef } from "react";

const MAX_BACKOFF_MS = 30_000;
const AUTH_CLOSE_CODE = 4401;

/**
 * Connect to a Django Channels WebSocket and call `onMessage` for each
 * inbound JSON frame. Auto-reconnects with exponential backoff (1s, 2s,
 * 4s, ...) up to 30s. Stops trying on close code 4401 (auth failure).
 *
 * @param path  Path under the same origin (e.g. "/ws/todos/").
 * @param onMessage  Called with the parsed JSON payload.
 */
export function useLiveChannel(path: string, onMessage: (msg: unknown) => void): void {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let backoffMs = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const scheme = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${scheme}://${window.location.host}${path}`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        backoffMs = 1000;
      };

      socket.onmessage = ev => {
        try {
          const parsed = JSON.parse(ev.data);
          onMessageRef.current(parsed);
        } catch (err) {
          console.error("useLiveChannel: bad JSON", err);
        }
      };

      socket.onclose = ev => {
        if (cancelled || ev.code === AUTH_CLOSE_CODE) {
          if (ev.code === AUTH_CLOSE_CODE) {
            console.warn(`useLiveChannel(${path}): auth rejected, not retrying`);
          }
          return;
        }
        reconnectTimer = setTimeout(connect, backoffMs);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [path]);
}
