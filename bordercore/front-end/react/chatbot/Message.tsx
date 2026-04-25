import React, { useMemo } from "react";
import type { ChatMessage } from "./types";
import { renderMarkdown } from "./markdown";
import { SanitizedHtml } from "./SanitizedHtml";
import { MessageActions } from "./MessageActions";
import { SaveAsNoteForm } from "./SaveAsNoteForm";
import { FollowUps } from "./FollowUps";

interface MessageProps {
  message: ChatMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
  followups: string[];
  saveFormOpen: boolean;
  onRegenerate: () => void;
  onOpenSaveForm: () => void;
  onCancelSaveForm: () => void;
  onSaveAsNote: (data: { title: string; tags: string }) => void;
  onSelectFollowUp: (text: string) => void;
}

function summarize(text: string): string {
  // First sentence, truncated to 80 chars.
  const firstSentence = text.split(/[.!?]\s/)[0] || text;
  return firstSentence.slice(0, 80).trim();
}

export function Message({
  message,
  isLastAssistant,
  isStreaming,
  followups,
  saveFormOpen,
  onRegenerate,
  onOpenSaveForm,
  onCancelSaveForm,
  onSaveAsNote,
  onSelectFollowUp,
}: MessageProps) {
  const html = useMemo(() => renderMarkdown(message.content), [message.content]);

  const showCursor = isLastAssistant && isStreaming;
  const isAssistant = message.role === "assistant";

  return (
    <div className={`chatbot-message chatbot-message--${message.role}`}>
      <div className="chatbot-message-who">{message.role === "user" ? "you" : "ai"}</div>
      <div className="chatbot-message-text">
        <SanitizedHtml html={html} />
        {showCursor && <span className="chatbot-cursor" />}
      </div>
      {message.content && (
        <MessageActions
          role={message.role}
          content={message.content}
          canRegenerate={isAssistant && isLastAssistant && !isStreaming}
          onRegenerate={onRegenerate}
          onSaveAsNote={onOpenSaveForm}
        />
      )}
      {saveFormOpen && (
        <SaveAsNoteForm
          defaultTitle={summarize(message.content)}
          onSave={onSaveAsNote}
          onCancel={onCancelSaveForm}
        />
      )}
      {isAssistant && isLastAssistant && !isStreaming && (
        <FollowUps suggestions={followups} onSelect={onSelectFollowUp} />
      )}
    </div>
  );
}

export default Message;
