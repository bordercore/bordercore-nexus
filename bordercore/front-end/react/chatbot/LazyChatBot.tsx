import React, { useEffect, useRef, useState } from "react";

interface ChatPayload {
  content?: string;
  questionUuid?: string;
  exerciseUuid?: string;
}

interface Props {
  blobUuid?: string;
  chatUrl: string;
  followupsUrl: string;
  djangoChatUrl?: string;
}

/**
 * Defers loading the chat bot until it is first opened.
 *
 * ChatBot pulls in markdown-it, highlight.js and its language grammars, and
 * MathJax handling — a large share of the modules on a cold page load — for a
 * panel that stays hidden until Alt-C or the user menu opens it. Because it is
 * mounted from the base template, every page paid that cost on every load.
 *
 * This stands in as a near-zero-cost listener on the same "chat" EventBus
 * channel. Only on the first event does it fetch the real component. Events
 * arriving while the chunk is in flight are queued and replayed once ChatBot
 * has mounted and subscribed, so the keypress that triggered the load still
 * opens the panel rather than being swallowed.
 */
export default function LazyChatBot(props: Props) {
  const [ChatBot, setChatBot] = useState<React.ComponentType<Props> | null>(null);
  const queued = useRef<ChatPayload[]>([]);
  const requested = useRef(false);

  useEffect(() => {
    // Once ChatBot is mounted it owns this channel, so stop listening.
    if (ChatBot) return;

    const bus = (window as { EventBus?: any }).EventBus;
    if (!bus) return;

    const handler = (payload: ChatPayload = {}) => {
      queued.current.push(payload);
      if (requested.current) return;
      requested.current = true;
      import("./ChatBot")
        .then(module => setChatBot(() => module.default))
        .catch(error => {
          // Let a later keypress retry rather than wedging the chat closed.
          requested.current = false;
          queued.current = [];
          console.error("Failed to load the chat bot", error);
        });
    };

    bus.$on("chat", handler);
    return () => bus.$off("chat", handler);
  }, [ChatBot]);

  useEffect(() => {
    if (!ChatBot) return;
    const bus = (window as { EventBus?: any }).EventBus;
    if (!bus) return;
    // Child effects run before parent effects, so ChatBot has already
    // subscribed to the bus by the time this replay fires.
    const pending = queued.current;
    queued.current = [];
    pending.forEach(payload => bus.$emit("chat", payload));
  }, [ChatBot]);

  if (!ChatBot) return null;
  return <ChatBot {...props} />;
}
