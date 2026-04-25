import React, { useEffect, useRef } from "react";
import type { ChatMessage } from "./types";
import { Message } from "./Message";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  followups: string[];
  saveFormOpenForId: number | null;
  onRegenerate: () => void;
  onOpenSaveForm: (id: number) => void;
  onCancelSaveForm: () => void;
  onSaveAsNote: (data: { title: string; tags: string }) => void;
  onSelectFollowUp: (text: string) => void;
}

export function MessageList({
  messages,
  isStreaming,
  followups,
  saveFormOpenForId,
  onRegenerate,
  onOpenSaveForm,
  onCancelSaveForm,
  onSaveAsNote,
  onSelectFollowUp,
}: MessageListProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const visible = messages.filter(m => m.role !== "system");
  const lastAssistantIdx = (() => {
    for (let i = visible.length - 1; i >= 0; i--) {
      if (visible[i].role === "assistant") return i;
    }
    return -1;
  })();

  return (
    <div className="chatbot-message-list" ref={ref}>
      {visible.map((m, i) => (
        <Message
          key={m.id}
          message={m}
          isLastAssistant={i === lastAssistantIdx}
          isStreaming={isStreaming}
          followups={i === lastAssistantIdx ? followups : []}
          saveFormOpen={saveFormOpenForId === m.id}
          onRegenerate={onRegenerate}
          onOpenSaveForm={() => onOpenSaveForm(m.id)}
          onCancelSaveForm={onCancelSaveForm}
          onSaveAsNote={onSaveAsNote}
          onSelectFollowUp={onSelectFollowUp}
        />
      ))}
    </div>
  );
}

export default MessageList;
