import { describe, expect, it, vi } from "vitest";
import { flattenSegmentsToText, streamDjangoReply } from "./streamDjangoReply";
import type { ChatMessage, DjangoSegment } from "./types";

vi.mock("../utils/reactUtils", () => ({ getCsrfToken: () => "csrf" }));

function makeStreamingResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function applyEventsToSegments(chunks: string[]): Promise<DjangoSegment[]> {
  return new Promise(async (resolve, reject) => {
    let segments: DjangoSegment[] = [];
    const fetchMock = vi.fn().mockResolvedValue(makeStreamingResponse(chunks));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await streamDjangoReply({
        url: "/api/chat/django",
        userText: "hi",
        signal: new AbortController().signal,
        updateAssistant: mutate => {
          segments = mutate(segments);
        },
      });
      resolve(segments);
    } catch (err) {
      reject(err);
    } finally {
      vi.unstubAllGlobals();
    }
  });
}

describe("streamDjangoReply", () => {
  it("accumulates text deltas into a single text segment", async () => {
    const segments = await applyEventsToSegments([
      'data: {"type": "text", "delta": "Hello "}\n\n',
      'data: {"type": "text", "delta": "world."}\n\n',
      'data: {"type": "done"}\n\n',
    ]);
    expect(segments).toEqual([{ kind: "text", text: "Hello world." }]);
  });

  it("creates tool segments and fills in output on tool_result", async () => {
    const segments = await applyEventsToSegments([
      'data: {"type": "tool_call", "id": "t1", "name": "django_shell", "input": {"code": "1+1"}}\n\n',
      'data: {"type": "tool_result", "id": "t1", "output": "2"}\n\n',
      'data: {"type": "done"}\n\n',
    ]);
    expect(segments).toEqual([
      { kind: "tool", id: "t1", name: "django_shell", input: { code: "1+1" }, output: "2" },
    ]);
  });

  it("interleaves text and tool segments in order", async () => {
    const segments = await applyEventsToSegments([
      'data: {"type": "text", "delta": "Checking... "}\n\n',
      'data: {"type": "tool_call", "id": "t1", "name": "django_shell", "input": {"code": "x"}}\n\n',
      'data: {"type": "tool_result", "id": "t1", "output": "ok"}\n\n',
      'data: {"type": "text", "delta": "done."}\n\n',
      'data: {"type": "done"}\n\n',
    ]);
    expect(segments.map(s => s.kind)).toEqual(["text", "tool", "text"]);
  });

  it("handles events that arrive split across chunks", async () => {
    // Split a single event mid-way across two read() calls.
    const segments = await applyEventsToSegments([
      'data: {"type": "text", "delta',
      '": "split"}\n\n',
      'data: {"type": "done"}\n\n',
    ]);
    expect(segments).toEqual([{ kind: "text", text: "split" }]);
  });

  it("pushes an error segment on type=error", async () => {
    const segments = await applyEventsToSegments([
      'data: {"type": "error", "message": "boom"}\n\n',
    ]);
    expect(segments).toEqual([{ kind: "error", message: "boom" }]);
  });
});

describe("flattenSegmentsToText", () => {
  it("concatenates only text segments", () => {
    const message: ChatMessage = {
      id: 1,
      role: "assistant",
      content: "",
      segments: [
        { kind: "text", text: "A " },
        { kind: "tool", id: "t1", name: "django_shell", input: {}, output: "ignored" },
        { kind: "text", text: "B" },
        { kind: "error", message: "ignored" },
      ],
    };
    expect(flattenSegmentsToText(message)).toBe("A B");
  });

  it("falls back to content when no segments are set", () => {
    const message: ChatMessage = { id: 1, role: "assistant", content: "raw" };
    expect(flattenSegmentsToText(message)).toBe("raw");
  });
});
