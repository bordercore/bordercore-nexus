import React, { useState } from "react";

interface SecretFieldProps {
  id?: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  canEdit?: boolean;
  autoComplete?: string;
  startRevealed?: boolean;
}

export function SecretField({
  id,
  value,
  onChange,
  placeholder,
  canEdit = true,
  autoComplete = "off",
  startRevealed = false,
}: SecretFieldProps) {
  const [revealed, setRevealed] = useState(startRevealed);
  const [copied, setCopied] = useState(false);
  const [focused, setFocused] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore - clipboard may be unavailable
    }
  };

  return (
    <div className={`prefs-secret${focused ? " focus" : ""}`}>
      <input
        id={id}
        className={`val${revealed ? "" : " masked"}`}
        type={revealed ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        readOnly={!canEdit}
        autoComplete={autoComplete}
      />
      <div className="actions">
        <button
          type="button"
          onClick={() => setRevealed(r => !r)}
          title={revealed ? "Hide" : "Show"}
        >
          {revealed ? "⊙ hide" : "⊙ show"}
        </button>
        <button
          type="button"
          onClick={copy}
          className={copied ? "copied" : ""}
          title="Copy to clipboard"
        >
          {copied ? "✓ copied" : "⎘ copy"}
        </button>
      </div>
    </div>
  );
}

export default SecretField;
