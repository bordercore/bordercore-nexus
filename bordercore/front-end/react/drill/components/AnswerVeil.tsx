import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye } from "@fortawesome/free-solid-svg-icons";

interface AnswerVeilProps {
  revealed: boolean;
  onReveal: () => void;
  children: React.ReactNode;
}

export function AnswerVeil({ revealed, onReveal, children }: AnswerVeilProps) {
  return (
    <div className={`answer-veil ${revealed ? "revealed" : ""}`}>
      <div className="veil-content">{children}</div>
      {!revealed && (
        <button type="button" className="veil-cta" onClick={onReveal} aria-label="Reveal answer">
          <span className="veil-cta-inner">
            <FontAwesomeIcon icon={faEye} className="answer-veil-eye" />
            reveal answer
            <kbd>space</kbd>
          </span>
        </button>
      )}
    </div>
  );
}

export default AnswerVeil;
