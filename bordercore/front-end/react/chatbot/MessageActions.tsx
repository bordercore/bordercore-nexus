import React, { useState } from "react";
import type { ChatRole } from "./types";

interface MessageActionsProps {
  role: ChatRole;
  content: string;
  canRegenerate: boolean;
  onRegenerate: () => void;
}

export function MessageActions({
  role,
  content,
  canRegenerate,
  onRegenerate,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="chatbot-message-actions">
      <button type="button" className="chatbot-action-btn" onClick={copy}>
        {copied ? "✓ copied" : "⧉ copy"}
      </button>
      {role === "assistant" && canRegenerate && (
        <button type="button" className="chatbot-action-btn" onClick={onRegenerate}>
          ↻ regenerate
        </button>
      )}
    </div>
  );
}

export default MessageActions;
