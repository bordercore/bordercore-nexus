import { getCsrfToken } from "../utils/reactUtils";
import type { ChatMessage, DjangoSegment } from "./types";

interface DjangoEvent {
  type: "text" | "tool_call" | "tool_result" | "done" | "error";
  delta?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  output?: string;
  message?: string;
}

interface StreamArgs {
  url: string;
  userText: string;
  signal: AbortSignal;
  updateAssistant: (mutate: (segments: DjangoSegment[]) => DjangoSegment[]) => void;
}

/**
 * POST the user's question to the Django-chat endpoint and stream the SSE
 * reply, calling `updateAssistant` after each event to mutate the trailing
 * assistant message's segments.
 *
 * v1 sends only the current question (no prior turns). Multi-turn requires
 * reconstructing tool_use/tool_result blocks for the API payload and is
 * intentionally deferred.
 */
export async function streamDjangoReply(args: StreamArgs): Promise<void> {
  const { url, userText, signal, updateAssistant } = args;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Csrftoken": getCsrfToken(),
    },
    body: JSON.stringify({ messages: [{ role: "user", content: userText }] }),
    signal,
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const reader = resp.body?.getReader();
  if (!reader) throw new Error("no body");
  const decoder = new TextDecoder("utf-8");

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line.
    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const event = parseSseEvent(raw);
      if (event) applyEvent(event, updateAssistant);
      sep = buffer.indexOf("\n\n");
    }
  }
}

function parseSseEvent(raw: string): DjangoEvent | null {
  // We only emit `data: <json>` lines on the server side.
  const dataLine = raw.split("\n").find(line => line.startsWith("data: "));
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine.slice("data: ".length)) as DjangoEvent;
  } catch {
    return null;
  }
}

function applyEvent(
  event: DjangoEvent,
  updateAssistant: (mutate: (segments: DjangoSegment[]) => DjangoSegment[]) => void
): void {
  updateAssistant(segments => {
    const next = [...segments];
    const last = next[next.length - 1];

    switch (event.type) {
      case "text":
        if (event.delta) {
          if (last && last.kind === "text") {
            next[next.length - 1] = { kind: "text", text: last.text + event.delta };
          } else {
            next.push({ kind: "text", text: event.delta });
          }
        }
        break;
      case "tool_call":
        if (event.id && event.name) {
          next.push({
            kind: "tool",
            id: event.id,
            name: event.name,
            input: event.input ?? {},
          });
        }
        break;
      case "tool_result":
        if (event.id) {
          for (let i = next.length - 1; i >= 0; i--) {
            const seg = next[i];
            if (seg.kind === "tool" && seg.id === event.id) {
              next[i] = { ...seg, output: event.output ?? "" };
              break;
            }
          }
        }
        break;
      case "error":
        next.push({ kind: "error", message: event.message ?? "Unknown error" });
        break;
      case "done":
        // No-op: the stream is done, but we don't mark anything special.
        break;
    }
    return next;
  });
}

/**
 * Concatenate all `text` segments from an assistant reply so we can pass it
 * to MessageActions (copy, save-as-note) and the follow-up generator.
 */
export function flattenSegmentsToText(message: ChatMessage): string {
  if (!message.segments) return message.content;
  return message.segments
    .filter((s): s is Extract<DjangoSegment, { kind: "text" }> => s.kind === "text")
    .map(s => s.text)
    .join("");
}
