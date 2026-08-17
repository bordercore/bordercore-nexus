import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import emitter from "tiny-emitter/instance";
import LazyChatBot from "./LazyChatBot";

// Stand-in for the real ChatBot: records that it mounted and subscribes to the
// same "chat" channel, so the replay path is exercised exactly as in the app.
const mounted = vi.fn();
const received: unknown[] = [];

vi.mock("./ChatBot", () => ({
  default: function FakeChatBot(props: { chatUrl: string }) {
    const [open, setOpen] = React.useState(false);
    React.useEffect(() => {
      mounted();
      const handler = (payload: unknown) => {
        received.push(payload);
        setOpen(true);
      };
      const bus = (window as { EventBus?: any }).EventBus;
      bus.$on("chat", handler);
      return () => bus.$off("chat", handler);
    }, []);
    return <div data-testid="chatbot">{open ? "open" : "closed"}</div>;
  },
}));

const bus = {
  $on: (...args: any[]) => (emitter as any).on(...args),
  $off: (...args: any[]) => (emitter as any).off(...args),
  $emit: (...args: any[]) => (emitter as any).emit(...args),
};

const props = {
  blobUuid: "",
  chatUrl: "/chat/",
  followupsUrl: "/followups/",
  djangoChatUrl: "/django-chat/",
};

describe("LazyChatBot", () => {
  beforeEach(() => {
    mounted.mockClear();
    received.length = 0;
    (window as any).EventBus = bus;
  });

  afterEach(() => {
    (emitter as any).e = {};
    delete (window as any).EventBus;
  });

  it("renders nothing and does not load ChatBot until the chat channel fires", () => {
    render(<LazyChatBot {...props} />);

    expect(screen.queryByTestId("chatbot")).not.toBeInTheDocument();
    expect(mounted).not.toHaveBeenCalled();
  });

  it("loads ChatBot on the first chat event", async () => {
    render(<LazyChatBot {...props} />);

    bus.$emit("chat", {});

    await waitFor(() => expect(screen.getByTestId("chatbot")).toBeInTheDocument());
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it("replays the triggering event so the panel actually opens", async () => {
    render(<LazyChatBot {...props} />);

    bus.$emit("chat", {});

    // Without the replay the chunk would load but the panel would stay closed,
    // because ChatBot subscribes only after the triggering event has passed.
    await waitFor(() => expect(screen.getByTestId("chatbot")).toHaveTextContent("open"));
    expect(received).toEqual([{}]);
  });

  it("preserves the payload of events queued while the chunk loads", async () => {
    render(<LazyChatBot {...props} />);

    bus.$emit("chat", { questionUuid: "abc-123" });
    bus.$emit("chat", { content: "hello" });

    await waitFor(() => expect(screen.getByTestId("chatbot")).toBeInTheDocument());
    await waitFor(() =>
      expect(received).toEqual([{ questionUuid: "abc-123" }, { content: "hello" }])
    );
    // One import, regardless of how many events arrived while it was in flight.
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it("stops listening once ChatBot owns the channel", async () => {
    render(<LazyChatBot {...props} />);

    bus.$emit("chat", {});
    await waitFor(() => expect(screen.getByTestId("chatbot")).toBeInTheDocument());

    bus.$emit("chat", { content: "second" });

    // ChatBot itself handles this one; the loader must not re-import or queue.
    await waitFor(() => expect(received).toHaveLength(2));
    expect(mounted).toHaveBeenCalledTimes(1);
  });
});
