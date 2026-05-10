import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

interface SaveBarProps {
  visible: boolean;
  dirty: boolean;
  changedCount: number;
  saving: boolean;
  justSaved: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function SaveBar({
  visible,
  dirty,
  changedCount,
  saving,
  justSaved,
  onSave,
  onDiscard,
}: SaveBarProps) {
  return (
    <div className={`prefs-savebar${visible ? " visible" : ""}`} role="status">
      <div className="inner">
        <div className="msg">
          {justSaved ? (
            <>
              <span className="ok-mark">✓</span>
              <span>saved · all changes applied</span>
            </>
          ) : (
            <>
              <span className="pulse" />
              <span>unsaved changes</span>
              <span className="diff">
                {changedCount} field{changedCount === 1 ? "" : "s"} modified
              </span>
            </>
          )}
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn ghost"
            onClick={onDiscard}
            disabled={!dirty || saving}
          >
            discard
          </button>
          <button
            type="button"
            className="btn primary"
            data-testid="prefs-save"
            onClick={onSave}
            disabled={!dirty || saving}
          >
            <FontAwesomeIcon icon={faCheck} className="refined-btn-icon" />
            <span>{saving ? "saving…" : "save"}</span>
            <span className="kbd">⌘S</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SaveBar;
