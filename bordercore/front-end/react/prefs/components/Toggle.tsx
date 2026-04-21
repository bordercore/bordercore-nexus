import React from "react";

interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}

export function Toggle({
  value,
  onChange,
  onLabel = "enabled",
  offLabel = "disabled",
}: ToggleProps) {
  return (
    <div className="prefs-toggle-wrap" data-on={String(value)}>
      <button
        type="button"
        className="prefs-toggle"
        data-on={String(value)}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        <span className="knob" />
      </button>
      <span className="state">{value ? onLabel : offLabel}</span>
    </div>
  );
}

export default Toggle;
