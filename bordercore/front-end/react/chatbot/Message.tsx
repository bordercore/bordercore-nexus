import React, { useMemo } from "react";
import type { ChatMessage } from "./types";
import { renderMarkdown } from "./markdown";
import { SanitizedHtml } from "./SanitizedHtml";
import { MessageActions } from "./MessageActions";
import { FollowUps } from "./FollowUps";

interface MessageProps {
  message: ChatMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
  followups: string[];
  onRegenerate: () => void;
  onSelectFollowUp: (text: string) => void;
}

export function Message({
  message,
  isLastAssistant,
  isStreaming,
  followups,
  onRegenerate,
  onSelectFollowUp,
}: MessageProps) {
  const html = useMemo(() => {
    if (message.segments) {
      const merged = message.segments
        .filter(s => s.kind === "text")
        .map(s => (s as { kind: "text"; text: string }).text)
        .join("");
      return renderMarkdown(merged);
    }
    return renderMarkdown(message.content);
  }, [message.content, message.segments]);

  const showCursor = isLastAssistant && isStreaming;
  const isAssistant = message.role === "assistant";

  return (
    <div className={`chatbot-message chatbot-message--${message.role}`}>
      <div className="chatbot-message-who">{message.role === "user" ? "you" : "ai"}</div>
      <div className="chatbot-message-text">
        <SanitizedHtml html={html} />
        {message.segments?.map((seg, i) =>
          seg.kind === "error" ? (
            <div key={i} className="chatbot-message-error">
              {seg.message}
            </div>
          ) : null
        )}
        {showCursor && <span className="chatbot-cursor" />}
      </div>
      {message.content && (
        <MessageActions
          role={message.role}
          content={message.content}
          canRegenerate={isAssistant && isLastAssistant && !isStreaming}
          onRegenerate={onRegenerate}
        />
      )}
      {isAssistant && isLastAssistant && !isStreaming && (
        <FollowUps suggestions={followups} onSelect={onSelectFollowUp} />
      )}
    </div>
  );
}

export default Message;
