import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faThumbtack } from "@fortawesome/free-solid-svg-icons";

interface ChatBotHeaderProps {
  pinned: boolean;
  onClose: () => void;
  onTogglePin: () => void;
}

export function ChatBotHeader({ pinned, onClose, onTogglePin }: ChatBotHeaderProps) {
  return (
    <div className="chatbot-header">
      <button
        type="button"
        className={`chatbot-pin-btn${pinned ? " chatbot-pin-btn--active" : ""}`}
        aria-label={pinned ? "unpin" : "pin to side"}
        onClick={onTogglePin}
      >
        <FontAwesomeIcon icon={faThumbtack} />
      </button>
      <button type="button" className="refined-modal-close" aria-label="close" onClick={onClose}>
        <FontAwesomeIcon icon={faTimes} />
      </button>
      {!pinned && (
        <>
          <h2 className="refined-modal-title">Ask the assistant</h2>
          <p className="refined-modal-lead">
            streaming answers from your notes, blobs, or open chat.
          </p>
        </>
      )}
    </div>
  );
}

export default ChatBotHeader;
