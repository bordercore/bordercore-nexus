import React from "react";

export interface ThemeOption {
  value: string;
  label: string;
  bg: string;
  panel: string;
  accent: string;
  text: string;
}

interface ThemePickerProps {
  value: string;
  onChange: (value: string) => void;
  themes: ThemeOption[];
}

export function ThemePicker({ value, onChange, themes }: ThemePickerProps) {
  return (
    <div className="prefs-theme-grid">
      {themes.map(t => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            className={`prefs-theme-card${selected ? " selected" : ""}`}
            onClick={() => onChange(t.value)}
            aria-pressed={selected}
            data-theme={t.value}
          >
            {/* Theme preview bars pull their colors from per-theme props.
                must remain inline — data-driven color values. */}
            <div className="theme-preview" style={{ background: t.bg }}>
              {/* must remain inline */}
              <div className="pv-row pv-row-title" style={{ background: t.text }} />
              {/* must remain inline */}
              <div className="pv-row pv-row-subtitle" style={{ background: t.text }} />
              {/* must remain inline */}
              <div className="pv-row pv-row-accent" style={{ background: t.accent }} />
              {/* must remain inline */}
              <div className="pv-row pv-row-panel" style={{ background: t.panel }} />
              <div
                className="pv-dot"
                // must remain inline
                style={{ background: t.accent, boxShadow: `0 0 8px ${t.accent}` }}
              />
            </div>
            <div className="name">
              <span>{t.label}</span>
              <span className="check">✓ active</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default ThemePicker;
